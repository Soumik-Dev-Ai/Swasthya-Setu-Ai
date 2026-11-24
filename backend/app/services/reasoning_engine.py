"""Text-path Reasoning Engine (doc 15 "Reasoning Engine — online backend").

The counterpart to the vision cascade: for NON-red-flag symptom text, this
retrieves clinical guideline chunks and asks the hosted LLM cascade to
classify severity *grounded only in that context*, then mechanically
verifies the citation. It shares the exact `grounding_reference` contract
and verifier as the vision path.

Guarantees (identical philosophy to the rest of the safety stack):
- The deterministic safety gate is *never* bypassed — this engine refuses
  to reason over inputs the gate has already flagged (it defers to L4).
- Every provider output carrying a citation passes the mechanical verifier
  before it is trusted; an unverified or fabricated citation is a
  cascade-stage failure, and the signal falls through to `uncertain`.
- Never raises, never does diagnosis, never downgrades an emergency.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from typing import Any

from app.core.config import settings
from app.services.provider_registry import get_cascade

logger = logging.getLogger(__name__)


def _get_text_cascade() -> list[tuple[str, str]]:
    """Dynamic — resolved at startup, always points to the best available model."""
    return get_cascade("text")

_PROMPT = (
    "You are a clinical decision-support assistant for rural India. "
    "You MUST NEVER name a disease as a diagnosis and NEVER suggest "
    "medication or dosage.\n"
    "Classify the symptom description into a severity signal only, and "
    "ground your answer strictly in the RETRIEVED_GUIDELINE_CONTEXT below "
    "(cite the chunk id that supports it). If no retrieved chunk adequately "
    "supports the classification, set grounding_reference to null rather "
    "than reasoning from memory.\n"
    "Output ONE JSON object on ONE line, no markdown, no prose:\n"
    '{ "severity_signal": <"emergency" | "non_serious" | "uncertain">, '
    '"finding_category": <short phrase>, "confidence": <0-100 int>, '
    '"reason": <one short sentence>, "grounding_reference": <chunk id or null> }\n'
)


@dataclass
class ReasoningResult:
    severity_signal: str
    finding_category: str
    confidence: int
    reason: str = ""
    grounding_reference: str | None = None
    grounding_verified: bool = False
    model_version: str = "reasoning.unrun"
    source: str = "reasoning_engine"

    def to_dict(self) -> dict[str, Any]:
        return {
            "severity_signal": self.severity_signal,
            "finding_category": self.finding_category,
            "confidence": self.confidence,
            "reason": self.reason,
            "grounding_reference": self.grounding_reference,
            "grounding_verified": self.grounding_verified,
            "model_version": self.model_version,
            "source": self.source,
        }


async def _retrieve(symptoms_text: str) -> list[dict[str, str]]:
    from .safety_layer import enforce_red_flag_safety
    from app.db.database import AsyncSessionLocal
    from .rag.retriever import search_corpus

    verdict = enforce_red_flag_safety(
        symptoms_text=symptoms_text, frontend_flags=[], text_level=1,
        visual_urgency_signal=None,
    )
    if verdict.emergency:
        return []  # the gate already decided L4; no reasoning needed
    try:
        async with AsyncSessionLocal() as session:
            hits = await search_corpus(session, symptoms_text, corpus="clinical")
        return [
            {"chunk_id": h.chunk_id, "text": h.text, "source_name": h.source_name,
             "section_path": h.section_path}
            for h in hits
        ]
    except Exception:
        return []


def _parse(text: str) -> ReasoningResult | None:
    if not text:
        return None
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    signal = str(obj.get("severity_signal", "uncertain")).strip().lower()
    if signal not in ("emergency", "non_serious", "uncertain"):
        signal = "uncertain"
    try:
        confidence = max(0, min(100, int(obj.get("confidence", 0))))
    except (TypeError, ValueError):
        confidence = 0
    ref = obj.get("grounding_reference")
    ref = str(ref).strip() if ref is not None else None
    return ReasoningResult(
        severity_signal=signal,
        finding_category=str(obj.get("finding_category", "")).strip()[:80],
        confidence=confidence,
        reason=str(obj.get("reason", "")).strip()[:500],
        grounding_reference=ref or None,
        model_version="parsed",
    )


async def analyze_text(
    symptoms_text: str, *, request_grounding: bool = True, chunks: list[dict[str, str]] | None = None
) -> ReasoningResult:
    """Run the grounded text-cascade. Always returns a ReasoningResult;
    never raises. Never escalates above what the safety gate allows —
    an `emergency` here still must pass through the gate in the caller.
    """
    from .safety_layer import enforce_red_flag_safety

    verdict = enforce_red_flag_safety(
        symptoms_text=symptoms_text, frontend_flags=[], text_level=1,
        visual_urgency_signal=None,
    )
    if verdict.emergency:
        return ReasoningResult(
            severity_signal="emergency", finding_category="red_flag",
            confidence=100, reason="Deterministic red flag; deferring to safety gate.",
            model_version="reasoning.deferred_to_gate",
        )

    if chunks is None:
        chunks = await _retrieve(symptoms_text) if request_grounding else []
    retrieved_ids = [c["chunk_id"] for c in chunks]
    retrieved_texts = {c["chunk_id"]: c["text"] for c in chunks}

    prompt = _PROMPT
    if chunks:
        lines = ["RETRIEVED_GUIDELINE_CONTEXT (cite chunk ids exactly):"]
        for c in chunks:
            lines.append(f"[{c['chunk_id']}] {c['text'][:900]}")
        prompt = "\n".join(lines) + "\n\n" + _PROMPT

    if not _get_text_cascade():
        return ReasoningResult(
            severity_signal="uncertain", finding_category="",
            confidence=0, reason="No LLM provider configured.",
            model_version="reasoning.no_keys",
        )

    user_content = prompt + f"\nPatient symptoms: {symptoms_text[:400]}"
    last_err = ""
    for env_key, model in _get_text_cascade():
        api_key = getattr(settings, env_key, "")
        if not api_key:
            continue
        try:
            import litellm  # type: ignore

            response = await asyncio.wait_for(
                litellm.acompletion(
                    model=model, api_key=api_key,
                    messages=[{"role": "user", "content": user_content}],
                    temperature=0.0, max_tokens=160,
                ),
                timeout=3.0,
            )
            raw = (response.choices[0].message.content or "").strip()
            result = _parse(raw)
            if result is not None and result.grounding_reference:
                from .rag.verifier import verify_grounding

                check = verify_grounding(
                    grounding_reference=result.grounding_reference,
                    retrieved_chunk_ids=retrieved_ids,
                    claimed_reason=result.reason or result.finding_category,
                    cited_chunk_text=retrieved_texts.get(result.grounding_reference),
                )
                if not check.ok:
                    last_err = f"{model}: grounding-unverified ({check.reason})"
                    logger.warning("Reasoning grounding rejected on %s: %s", model, check.reason)
                    continue
                result.grounding_verified = True
            if (
                result is not None
                and not result.grounding_reference
                and retrieved_ids
            ):
                # Phase-5 item 5E: guideline chunks WERE retrieved and given
                # to the model, yet it cited none — an ungrounded answer is
                # a cascade stage failure, never an accepted pass-through.
                last_err = f"{model}: ungrounded ({len(retrieved_ids)} chunks retrieved, none cited)"
                logger.warning(
                    "[Cascade] %s failed mid-session: ungrounded output despite %s retrieved chunks. Falling through.",
                    model, len(retrieved_ids),
                )
                continue
            if result is not None:
                result.model_version = f"cascade.{model}"
                result.source = "reasoning_engine"
                return result
            last_err = f"{model}: parse-failed"
        except asyncio.TimeoutError:
            last_err = f"{model}: timeout"
            logger.warning("[Cascade] %s failed mid-session: timeout. Falling through.", model)
        except Exception as exc:
            last_err = f"{model}: {exc}"
            logger.warning("[Cascade] %s failed mid-session: %s. Falling through.", model, exc)

    return ReasoningResult(
        severity_signal="uncertain", finding_category="",
        confidence=0, reason=f"All providers failed ({last_err or 'no keys'}).",
        model_version="cascade.failed",
    )


__all__ = ["ReasoningResult", "analyze_text"]