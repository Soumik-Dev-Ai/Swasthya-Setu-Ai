"""Intent Classifier (docs/16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md, Task 1).

Design contract:
1. The deterministic safety gate sees EVERY input before any routing —
   a routing bug must never become a safety bug.
2. Deterministic keyword/pattern pass first (zero-latency, zero-cost).
3. A single lightweight LLM call is used ONLY when the deterministic pass
   is inconclusive (no keyword evidence at all). Its output is constrained
   to the same three labels; malformed output resolves conservatively.
4. Mixed intent ("I have chest pain, what will it cost?") is a first-class
   outcome — it routes to BOTH pipelines, never silently drops one.
5. Never raises; every failure path resolves to a deterministic, cautious
   answer.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, asdict

# --- Deterministic vocabulary (small, reviewable; extend via code review) ---

_COST_TERMS: tuple[str, ...] = (
    # English
    "cost", "price", "pricing", "charges", "charge", "fees", "fee", "bill",
    "billing", "expense", "expenditure", "estimate", "quotation", "quote",
    "insurance", "policy", "premium", "claim", "coverage", "cover",
    "cashless", "reimbursement", "reimburse", "afford", "emi", "loan",
    "discount", "subsidy", "free treatment", "free medicine",
    # Schemes / program names (cost-adjacent intent in this product)
    "pmjay", "pm-jay", "ayushman", "cghs", "esic", "jsy", "pmndp",
    "chiranjeevi", "wbhs", "amrit", "jan aushadhi", "pm bjp", "pmbjp",
    # Hinglish (Latin-script) cost vocabulary
    "kitna", "kitne", "kitni", "kharcha", "kharche", "kharch", "paisa",
    "paise", "mullya", "daam", "lagat", "yojana", "sulabh",
)

_SYMPTOM_TERMS: tuple[str, ...] = (
    # English general symptom vocabulary (distinct from the safety list,
    # which is consulted separately and first, every time).
    "fever", "pain", "ache", "aching", "cough", "coughing", "cold",
    "vomit", "vomiting", "nausea", "diarrhea", "diarrhoea", "loose motion",
    "rash", "itch", "itching", "swelling", "swollen", "dizzy", "dizziness",
    "vertigo", "faint", "fainting", "weakness", "fatigue", "tired",
    "headache", "migraine", "breathing", "breath", "breathless",
    "wound", "cut", "injury", "fracture", "sprain", "burn", "bleeding",
    "infection", "pus", "boil", "cramp", "spasms", "stiff", "stiffness",
    "pregnant", "pregnancy", "period", "urine", "urination", "stool",
    "appetite", "weight loss", "weight gain", "sleep", "anxiety",
    "depression", "diabetes", "sugar", "bp", "blood pressure", "thyroid",
    "asthma", "allergy", "allergic", "dengue", "malaria", "typhoid",
    # Hinglish symptom vocabulary
    "bukhar", "khansi", "ulti", "dard", "dukh", "chot", "sujan",
    "chakkar", "kamzori", "garmi", "sardi", "pet kharab", "loose",
)

_RE_SPLIT = re.compile(r"\s+")

# Confidence shaping: first hit is decisive-ish (0.9), each extra hit nudges
# toward 0.99; never 1.0 — only the safety gate gets to be certain.
_CONFIDENCE_BASE = 0.90
_CONFIDENCE_STEP = 0.03
_CONFIDENCE_CAP = 0.99
_INCONCLUSIVE_CONFIDENCE = 0.20


@dataclass(frozen=True)
class IntentVerdict:
    intent: str  # "symptom" | "cost_scheme" | "both"
    confidence: float
    method: str  # "deterministic" | "llm_fallback"


def _normalize(text: str) -> str:
    t = unicodedata.normalize("NFC", text).lower()
    # Pad with spaces so substring checks don't match inside longer words
    # (e.g. "feeling" must not trigger "fee").
    t = _RE_SPLIT.sub(" ", t)
    return f" {t} "


def _hits(text_norm: str, terms: tuple[str, ...]) -> list[str]:
    return [term for term in terms if f" {term} " in text_norm]


def _classify_deterministic(text: str) -> tuple[list[str], list[str]]:
    norm = _normalize(text)
    return _hits(norm, _SYMPTOM_TERMS), _hits(norm, _COST_TERMS)


def _verdict_from_hits(symptom_hits: list[str], cost_hits: list[str]) -> IntentVerdict | None:
    """Map hit counts to a verdict; None means inconclusive (LLM fallback allowed)."""
    s, c = len(symptom_hits), len(cost_hits)
    if s == 0 and c == 0:
        return None  # genuinely ambiguous — the only LLM-fallback trigger
    strength = s + c
    confidence = min(_CONFIDENCE_CAP, _CONFIDENCE_BASE + _CONFIDENCE_STEP * (strength - 1))
    if s > 0 and c > 0:
        return IntentVerdict("both", confidence, "deterministic")
    if s > 0:
        return IntentVerdict("symptom", confidence, "deterministic")
    return IntentVerdict("cost_scheme", confidence, "deterministic")


async def _classify_with_llm(text: str) -> IntentVerdict | None:
    """Single constrained classification call on the first configured
    provider. Strict 5s timeout; any failure resolves to None so the
    caller degrades deterministically. Never raises."""
    try:
        from app.core.config import settings
        from app.services.provider_registry import get_cascade

        # Registry-served cascade (phase-5 item 5D): providers whose keys are
        # configured, best-first — no hardcoded model names to drift stale.
        cascade = get_cascade("text")
        provider = cascade[0] if cascade else None
        if provider is None:
            return None  # no keys configured — deterministic floor
        env_key, model = provider
        import asyncio
        import json

        import litellm  # type: ignore

        prompt = (
            "Classify the user message into exactly one intent: "
            '"symptom", "cost_scheme", or "both". '
            'Return ONLY one-line JSON: {"intent": "<label>", "confidence": <0..1>}.\n'
            f"Message: {text[:400]}"
        )
        response = await asyncio.wait_for(
            litellm.acompletion(
                model=model,
                api_key=getattr(settings, env_key),
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=60,
            ),
            timeout=5.0,
        )
        raw = (response.choices[0].message.content or "").strip()
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            return None
        payload = json.loads(match.group(0))
        intent = str(payload.get("intent", "")).strip()
        if intent not in ("symptom", "cost_scheme", "both"):
            return None
        confidence = float(payload.get("confidence", 0.5))
        return IntentVerdict(
            intent=intent,
            confidence=max(0.0, min(1.0, confidence)),
            method="llm_fallback",
        )
    except Exception:
        return None


async def classify(text: str) -> IntentVerdict:
    """Public entry — deterministic first, LLM only on inconclusive input.

    The safety gate runs OUTSIDE this function (in the route layer) on every
    request before this classifier is consulted; nothing here can bypass it.
    """
    if not text or not text.strip():
        # Empty input defaults to the conservative clinical route.
        return IntentVerdict("symptom", _INCONCLUSIVE_CONFIDENCE, "deterministic")

    verdict = _verdict_from_hits(*_classify_deterministic(text))
    if verdict is not None:
        return verdict

    llm = await _classify_with_llm(text)
    if llm is not None:
        return llm

    # Inconclusive + no/limited LLM: default toward clinical caution.
    return IntentVerdict("symptom", _INCONCLUSIVE_CONFIDENCE, "deterministic")


__all__ = ["IntentVerdict", "classify"]
