"""Vision LLM cascade service.

Routes an uploaded medical image through Gemini → Groq → NVIDIA via
litellm, falling through on failure/timeout. Per the V3 deep-integration
spec, this output is a *signal*, never a verdict — the deterministic
safety layer (services.safety_layer.enforce_red_flag_safety) makes the
final urgency call.

Output contract:
- `visual_symptom_category`: one of the curated condition IDs from
  v2_data.CONDITIONS, or "unknown".
- `visual_urgency_signal`: "emergency" | "non_serious" | "uncertain".
- `confidence`: 0–100.
- `model_version`: which cascade stage produced the result.
- `source`: "vision_llm_cascade".

The vision model is NEVER asked to give diagnosis, treatment, or
home-care advice. Prompt is hard-coded to structured output only.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
from dataclasses import dataclass
from typing import Any

from . import v2_data
from ..core.config import settings

logger = logging.getLogger(__name__)


# Allowed symptom categories. Reuses the existing taxonomy verbatim —
# no parallel taxonomy is invented.
ALLOWED_CATEGORIES: tuple[str, ...] = tuple(c["id"] for c in v2_data.CONDITIONS) + ("unknown",)

URGENCY_EMERGENCY = "emergency"
URGENCY_NON_SERIOUS = "non_serious"
URGENCY_UNCERTAIN = "uncertain"
ALLOWED_URGENCY: tuple[str, ...] = (URGENCY_EMERGENCY, URGENCY_NON_SERIOUS, URGENCY_UNCERTAIN)


@dataclass
class VisionSignal:
    visual_symptom_category: str
    visual_urgency_signal: str
    confidence: int
    model_version: str
    source: str
    grounding_reference: str | None = None
    grounding_verified: bool = False
    # The model's own one-line justification — the grounding verifier scores
    # overlap against THIS, not against the structured fields.
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "visual_symptom_category": self.visual_symptom_category,
            "visual_urgency_signal": self.visual_urgency_signal,
            "confidence": self.confidence,
            "model_version": self.model_version,
            "source": self.source,
            "grounding_reference": self.grounding_reference,
            "grounding_verified": self.grounding_verified,
            "reason": self.reason,
        }


# Hard-coded prompt. Critical: this is effectively the *only* prompt the
# vision model sees. It constrains output to structured categories — no
# diagnosis, no treatment, no prose advice. When the Knowledge Engine has
# retrieved guideline context, the prompt additionally requires the model
# to cite which retrieved chunk supports its reading (grounding_reference)
# — that citation is mechanically verified downstream before use.
_VISION_PROMPT = (
    "You are a medical-image triage assistant. Classify the image ONLY "
    "into the structured fields below. Do NOT provide diagnosis, "
    "treatment, or home-care instructions.\n"
    "Output ONE JSON object on ONE line, no markdown, no prose:\n"
    "{ \"visual_symptom_category\": <one of: "
    + ", ".join(ALLOWED_CATEGORIES)
    + ">, \"visual_urgency_signal\": <one of: emergency | non_serious | uncertain>, "
    "\"confidence\": <0-100 int>, \"reason\": <one short sentence>, "
    "\"grounding_reference\": <chunk id from RETRIEVED_GUIDELINE_CONTEXT that "
    "supports this classification, or null if none applies> }\n"
    "If no retrieved chunk adequately supports the classification, set "
    "grounding_reference to null rather than reasoning from memory.\n"
)


from app.services.provider_registry import get_cascade


def _get_vision_cascade() -> list[tuple[str, str]]:
    """Dynamic — resolved at startup, always points to the best available model."""
    return get_cascade("vision")


def _encode_image_for_llm(image_bytes: bytes, mime_type: str) -> dict[str, str]:
    """Encode uploaded bytes for litellm vision providers."""
    b64 = base64.b64encode(image_bytes).decode("ascii")
    return {
        "type": "image_url",
        "image_url": {"url": f"data:{mime_type};base64,{b64}"},
    }


def _parse_vision_output(text: str) -> VisionSignal | None:
    """Defensive JSON parse of the model's one-line response."""
    if not text:
        return None
    fenced = re.search(r"\{.*\}", text, re.DOTALL)
    if not fenced:
        return None
    try:
        obj = json.loads(fenced.group(0))
    except json.JSONDecodeError:
        return None

    category = str(obj.get("visual_symptom_category", "unknown")).strip().lower()
    if category not in ALLOWED_CATEGORIES:
        # Map free-form outputs onto the closest known bucket, then to unknown.
        category = "unknown"

    urgency = str(obj.get("visual_urgency_signal", URGENCY_UNCERTAIN)).strip().lower()
    if urgency not in ALLOWED_URGENCY:
        urgency = URGENCY_UNCERTAIN

    try:
        confidence = max(0, min(100, int(obj.get("confidence", 0))))
    except (TypeError, ValueError):
        confidence = 0

    grounding_reference = obj.get("grounding_reference")
    if grounding_reference is not None:
        grounding_reference = str(grounding_reference).strip() or None

    return VisionSignal(
        visual_symptom_category=category,
        visual_urgency_signal=urgency,
        confidence=confidence,
        model_version="parsed",
        source="vision_llm_cascade",
        grounding_reference=grounding_reference,
        reason=str(obj.get("reason", "")).strip()[:500],
    )


async def _retrieve_guideline_chunks(symptoms_text: str) -> list[dict[str, str]]:
    """Fetch guideline chunks for grounding the vision cascade.

    Returns [] when the corpus is empty, the text carries a red flag
    (the safety gate already decided — grounding adds nothing), or on any
    internal failure. Never raises; grounding is a strict enhancement,
    absent-it-only means the cascade runs ungrounded as before.
    """
    try:
        if not symptoms_text.strip():
            return []
        from .safety_layer import enforce_red_flag_safety

        verdict = enforce_red_flag_safety(
            symptoms_text=symptoms_text,
            frontend_flags=[],
            text_level=1,
            visual_urgency_signal=None,
        )
        if verdict.emergency:
            return []  # already L4 by deterministic authority
        from app.db.database import AsyncSessionLocal
        from .rag.retriever import search_corpus

        async with AsyncSessionLocal() as session:
            hits = await search_corpus(session, symptoms_text, corpus="clinical")
        return [
            {
                "chunk_id": h.chunk_id,
                "text": h.text,
                "source_name": h.source_name,
                "section_path": h.section_path,
            }
            for h in hits
        ]
    except Exception:
        return []


async def analyze_image(
    *,
    image_bytes: bytes,
    mime_type: str,
    symptoms_text: str = "",
) -> VisionSignal:
    """Run the vision cascade over the uploaded image.

    Returns a VisionSignal always; on every-provider-fail returns a
    `uncertain` signal with confidence=0. Never raises — the safety
    layer is designed to be safe on uncertain input.

    Note (Phase 3 item B5): vision results are intentionally NOT cached.
    Patient images and their analyses are sensitive, per-session data, and
    doc 04 §6 / NFR-6 forbid retaining them beyond the active session.
    """
    if not _any_vision_key_set():
        return VisionSignal(
            visual_symptom_category="unknown",
            visual_urgency_signal=URGENCY_UNCERTAIN,
            confidence=0,
            model_version="cascade.no_keys",
            source="vision_llm_cascade",
        )

    # Grounding: fetch guideline context before engaging any provider.
    # Absent/empty corpus → the cascade runs exactly as it always has.
    guideline_chunks = await _retrieve_guideline_chunks(symptoms_text)
    retrieved_ids = [c["chunk_id"] for c in guideline_chunks]
    retrieved_texts = {c["chunk_id"]: c["text"] for c in guideline_chunks}

    prompt = _VISION_PROMPT
    if guideline_chunks:
        context_lines = ["RETRIEVED_GUIDELINE_CONTEXT (cite chunk ids exactly):"]
        for chunk in guideline_chunks:
            context_lines.append(f"[{chunk['chunk_id']}] {chunk['text'][:900]}")
        prompt = "\n".join(context_lines) + "\n\n" + _VISION_PROMPT

    image_part = _encode_image_for_llm(image_bytes, mime_type)
    user_content: list[dict[str, Any]] = [
        {"type": "text", "text": prompt},
        image_part,
    ]
    if symptoms_text:
        user_content.append({"type": "text", "text": f"Patient symptoms: {symptoms_text[:400]}"})

    last_err = ""
    for env_key, model in _get_vision_cascade():
        api_key = getattr(settings, env_key, "")
        if not api_key:
            continue
        try:
            import litellm  # type: ignore
            response = await asyncio.wait_for(
                litellm.acompletion(
                    model=model,
                    api_key=api_key,
                    messages=[{"role": "user", "content": user_content}],
                    temperature=0.0,
                    max_tokens=160,
                ),
                timeout=15.0,
            )
            text = (response.choices[0].message.content or "").strip()
            signal = _parse_vision_output(text)
            if signal is not None and signal.grounding_reference:
                # Mechanical verification before the citation is trusted:
                # a hallucinated/misapplied reference is a stage failure.
                from .rag.verifier import verify_grounding

                claimed = signal.reason or (
                    f"{signal.visual_symptom_category} {signal.visual_urgency_signal}"
                )
                check = verify_grounding(
                    grounding_reference=signal.grounding_reference,
                    retrieved_chunk_ids=retrieved_ids,
                    claimed_reason=claimed,
                    cited_chunk_text=retrieved_texts.get(signal.grounding_reference),
                )
                if not check.ok:
                    last_err = f"{model}: grounding-unverified ({check.reason})"
                    logger.warning("Vision grounding rejected on %s: %s", model, check.reason)
                    continue  # try the next provider; never accept unverified
                signal.grounding_verified = True
            if (
                signal is not None
                and not signal.grounding_reference
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
            if signal is not None:
                signal.model_version = f"cascade.{model}"
                return signal
            last_err = f"{model}: parse-failed"
        except asyncio.TimeoutError:
            last_err = f"{model}: timeout"
            logger.warning("[Cascade] %s failed mid-session: timeout. Falling through.", model)
        except Exception as exc:
            last_err = f"{model}: {exc}"
            logger.warning("[Cascade] %s failed mid-session: %s. Falling through.", model, exc)

    signal = VisionSignal(
        visual_symptom_category="unknown",
        visual_urgency_signal=URGENCY_UNCERTAIN,
        confidence=0,
        model_version=f"cascade.failed",
        source="vision_llm_cascade",
    )
    return signal


def _any_vision_key_set() -> bool:
    return bool(settings.GEMINI_API_KEY or settings.GROQ_API_KEY or settings.NVIDIA_API_KEY)


__all__ = [
    "VisionSignal",
    "URGENCY_EMERGENCY",
    "URGENCY_NON_SERIOUS",
    "URGENCY_UNCERTAIN",
    "analyze_image",
]
