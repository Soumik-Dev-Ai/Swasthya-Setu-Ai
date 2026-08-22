"""AI client stub.

The real ML microservice (triage + scheme-match) is built by another team.
This module exposes async functions with mock responses so frontend/mobile
integration is unblocked. When the ML service is ready, replace the bodies
below with HTTP calls to `settings.AI_SERVICE_URL` (use httpx.AsyncClient).
"""
import asyncio
import hashlib
import random
from dataclasses import dataclass


@dataclass
class TriagePrediction:
    urgency_tier: str  # "EMERGENCY" | "URGENT" | "ROUTINE" | "SELF_CARE"
    symptom_category: str
    confidence: float


@dataclass
class SchemeMatchPredictions:
    scheme_ids: list[int]
    confidence: float


# Symptom -> category mapping used by the mock model.
_SYMPTOM_CATEGORY_MAP = {
    "chest pain": "cardiac",
    "breathless": "respiratory",
    "fever": "infectious",
    "bleeding": "trauma",
    "pregnan": "maternal",
    "diarrh": "gastrointestinal",
    "vomit": "gastrointestinal",
    "rash": "dermatological",
    "headache": "neurological",
    " seizure": "neurological",
    "stroke": "neurological",
    "weakness": "general",
    "cough": "respiratory",
    "child": "pediatric",
}


def infer_symptom_category(symptoms: str) -> str:
    text = symptoms.lower()
    for keyword, category in _SYMPTOM_CATEGORY_MAP.items():
        if keyword in text:
            return category
    return "general"


async def predict_triage(symptoms: str) -> TriagePrediction:
    """Mocked `POST /predict/triage` call to the AI microservice.

    Produces a deterministic-ish mock based on text hash so the same symptom
    string returns a consistent urgency tier. The deterministic safety layer
    in `triage_service` always has final authority on EMERGENCY overrides.
    """
    await asyncio.sleep(0)  # cooperative async slot for future network I/O

    text = symptoms.lower()
    digest = int(hashlib.sha256(text.encode("utf-8")).hexdigest(), 16)
    categories = ["SELF_CARE", "ROUTINE", "URGENT"]
    tier = categories[digest % len(categories)]

    # Heuristic tilt: a few phrases look severe even outside red-flag logic.
    if any(k in text for k in ("severe", "unconscious", "not breathing")):
        tier = "URGENT"

    return TriagePrediction(
        urgency_tier=tier,
        symptom_category=infer_symptom_category(symptoms),
        confidence=round(random.uniform(0.6, 0.95), 2),
    )


async def predict_scheme_match(
    facility_id: int,
    procedure_category: str,
    user_context: dict | None = None,
) -> SchemeMatchPredictions:
    """Mocked `POST /predict/scheme-match` call.

    Returns a subset of scheme ids deterministically derived from inputs so
    behaviour is reproducible across runs.
    """
    await asyncio.sleep(0)
    user_context = user_context or {}
    base = f"{facility_id}:{procedure_category}".encode("utf-8")
    digest = int(hashlib.sha256(base).hexdigest(), 16)
    # Assume scheme ids 1 and 2 exist (seed data). Pick a deterministic subset.
    candidate_ids = [1, 2]
    scheme_ids = [sid for sid in candidate_ids if (digest >> (sid * 3)) & 1]
    if not scheme_ids:
        scheme_ids = [1]
    return SchemeMatchPredictions(
        scheme_ids=scheme_ids,
        confidence=round(random.uniform(0.5, 0.9), 2),
    )
