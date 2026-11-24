"""AI client stub."""
from dataclasses import dataclass


@dataclass
class TriagePrediction:
    urgency_tier: str
    symptom_category: str
    confidence: float


@dataclass
class SchemeMatchPredictions:
    scheme_ids: list[int]
    confidence: float


async def predict_triage(symptoms: str) -> TriagePrediction:
    """Mocked triage predictor stub."""
    return TriagePrediction(urgency_tier="ROUTINE", symptom_category="general", confidence=0.85)


async def predict_scheme_match(
    facility_id: int,
    procedure_category: str,
    user_context: dict | None = None,
) -> SchemeMatchPredictions:
    """Mocked scheme match stub."""
    return SchemeMatchPredictions(scheme_ids=[1, 2], confidence=0.85)
