"""Triage service: deterministic safety envelope around mocked AI.

The AI prediction is ONLY used as a hint. Hardcoded red-flag keywords always
win and force the `EMERGENCY` tier — guaranteeing a deterministic medical
safety override regardless of model behaviour.
"""
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.triage import TriageSession
from app.services import ai_client

# Hardcoded clinical red-flags. Keep conservative; when in doubt escalate.
RED_FLAG_KEYWORDS: tuple[str, ...] = (
    "chest pain",
    "difficulty breathing",
    "shortness of breath",
    "unconscious",
    "unresponsive",
    "not breathing",
    "severe bleeding",
    "heavy bleeding",
    "stroke",
    "facial droop",
    "seizure",
    "fits",
    "convulsion",
    "suicidal",
    "suicide",
    "antepartum haemorrhage",
    "ap h",
    "severe headache",
    "stiff neck",
    "blue lips",
    "cyanosis",
    "no pulse",
    "foreign body airway obstruction",
    "choking",
    "newborn not breathing",
    "postpartum haemorrhage",
    "pph",
    "eclampsia",
    "convulsion in pregnanc",
)

# Map urgency tier -> required facility tier (used by routing engine downstream).
TIER_FACILITY_MAP = {
    "EMERGENCY": ("CHC", "PM-JAY_Hospital"),
    "URGENT": ("PHC", "CHC", "PM-JAY_Hospital"),
    "ROUTINE": ("SC", "PHC", "CHC"),
    "SELF_CARE": ("PMBJP_Pharmacy", "SC", "PHC"),
}


async def analyze_triage(
    db: AsyncSession,
    symptoms: str,
    location: dict,
) -> dict:
    """Analyze symptoms, apply safety override, persist anonymized log, return result.

    Returns a dict suitable for the `TriageResult` schema (no PII stored).
    """
    prediction = await ai_client.predict_triage(symptoms)

    overridden = False
    symptoms_lower = symptoms.lower()
    if any(flag in symptoms_lower for flag in RED_FLAG_KEYWORDS):
        urgency = "EMERGENCY"
        overridden = True
    else:
        urgency = prediction.urgency_tier

    region_parts = [
        str(location.get("district") or "").strip(),
        str(location.get("state") or "").strip(),
    ]
    region = ", ".join([p for p in region_parts if p])

    # Anonymized log — no symptoms text, no patient identifiers.
    session = TriageSession(
        urgency_tier=urgency,
        symptom_category=prediction.symptom_category,
        region=region,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.flush()

    return {
        "urgency_tier": urgency,
        "symptom_category": prediction.symptom_category,
        "region": region,
        "timestamp": session.timestamp,
        "overridden_by_safety_layer": overridden,
    }
