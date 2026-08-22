"""Deterministic red-flag safety layer (defense-in-depth).

This module is the FINAL AUTHORITY on urgency classification for the
triage pipeline. It is intentionally deterministic (no LLM, no ML) so
its behaviour can be reviewed, audited, and tested without external
dependencies.

AI Ethics Rule 1: the AI never has unilateral final authority on urgency.
- Vision LLM may *escalate* (suggest Emergency) — "fail toward caution".
- Vision LLM may NOT *downgrade* a red-flag case to non-serious on its
  own. The keyword check below is the backstop that catches "vision says
  mild rash" + "text says chest pain" mismatches.

Guardrails:
- Pure function, no I/O, no clock. Deterministic.
- Substring match (case-insensitive) against an explicit, hardcoded
  English keyword list. Multilingual red-flag coverage is the
  responsibility of the upstream category classifier; this module is the
  last-mile safety net.
- Returns a structured `SafetyVerdict` — never raises.
"""
from __future__ import annotations

from dataclasses import dataclass


# Hardcoded red-flag phrases. Case-insensitive substring match.
# Add new entries only after clinical review; do not auto-generate.
RED_FLAG_KEYWORDS: tuple[str, ...] = (
    "chest pain",
    "सीने में दर्द",
    "বুকের ব্যথা",
    "difficulty breathing",
    "can't breathe",
    "cannot breathe",
    "shortness of breath",
    "unconscious",
    "unresponsive",
    "stroke",
    "facial droop",
    "slurred speech",
    "seizure",
    "convulsion",
    "suicidal",
    "suicide",
    "self harm",
    "self-harm",
    "postpartum haemorrhage",
    "postpartum hemorrhage",
    "eclampsia",
    "severe bleeding",
    "heavy bleeding",
    "anaphylaxis",
    "anaphylactic",
    "snake bite",
    "snakebite",
    "head injury",
    "major trauma",
    "burn",
    "poisoning",
    "overdose",
    "heart attack",
    "cardiac arrest",
    "no pulse",
    "not breathing",
    "blue lips",
    "blue skin",
    "cyanosis",
)


# Vision-LLM urgency signal vocabulary (matches prompt contract below).
EMERGENCY_URGENCY_SIGNAL = "emergency"
NON_SERIOUS_URGENCY_SIGNAL = "non_serious"


@dataclass(frozen=True)
class SafetyVerdict:
    """The deterministic safety layer's final call.

    Attributes:
        emergency: True if this case must be treated as an emergency,
            regardless of any AI model output.
        level: 1–4 urgency level. 4 = emergency.
        triggered_keywords: which red-flag phrases matched (for audit).
        vision_escalated: True if the vision model escalated an otherwise
            non-emergency text-only result. Surfaced transparently to the
            user (per frontend spec).
        vision_downgrade_blocked: True if the vision model attempted to
            downgrade a red-flag case — the downgrade was rejected.
    """

    emergency: bool
    level: int
    triggered_keywords: tuple[str, ...]
    vision_escalated: bool
    vision_downgrade_blocked: bool


def _text_emergency(text: str) -> tuple[bool, tuple[str, ...]]:
    """Substring scan over the user's symptoms text."""
    if not text:
        return False, ()
    haystack = text.lower()
    hits = tuple(kw for kw in RED_FLAG_KEYWORDS if kw in haystack)
    return (len(hits) > 0), hits


def enforce_red_flag_safety(
    *,
    symptoms_text: str,
    frontend_flags: list[str] | tuple[str, ...] = (),
    text_level: int,
    visual_urgency_signal: str | None = None,
) -> SafetyVerdict:
    """Apply the deterministic safety layer to triage inputs.

    The vision model's `visual_urgency_signal` is a *signal*, not a
    verdict. This function enforces:

    1. If the user's text contains any red-flag keyword → EMERGENCY.
       (Cannot be downgraded by the vision model.)
    2. If the frontend already flagged emergency symptoms → EMERGENCY.
    3. If the vision model signals Emergency and text does not → escalate
       to EMERGENCY. ("Fail toward caution.")
    4. If the vision model signals non-serious BUT text contains red-flag
       keywords → ignore the vision downgrade. (`vision_downgrade_blocked=True`.)
    5. Otherwise: trust the text-level result.

    Args:
        symptoms_text: Raw user-described symptoms (may be empty).
        frontend_flags: UI-checkbox flags posted by the frontend.
        text_level: The level (1–4) computed by the text pathway.
        visual_urgency_signal: One of {"emergency", "non_serious", None}.
            `None` means no image was attached.

    Returns:
        SafetyVerdict — always populated; never raises.
    """
    text_emergency, hits = _text_emergency(symptoms_text)
    frontend_emergency = bool(frontend_flags) and len(frontend_flags) > 0

    vision_emergency = (
        visual_urgency_signal is not None
        and visual_urgency_signal.lower() == EMERGENCY_URGENCY_SIGNAL
    )
    vision_non_serious = (
        visual_urgency_signal is not None
        and visual_urgency_signal.lower() == NON_SERIOUS_URGENCY_SIGNAL
    )

    vision_escalated = bool(vision_emergency) and not text_emergency and not frontend_emergency

    # The deterministic guarantee: text/frontend red flag → emergency,
    # full stop. The vision model can never override this.
    if text_emergency or frontend_emergency:
        return SafetyVerdict(
            emergency=True,
            level=4,
            triggered_keywords=hits,
            vision_escalated=vision_escalated,
            vision_downgrade_blocked=bool(vision_non_serious),
        )

    # Vision model signals Emergency → escalate. Fail toward caution.
    if vision_emergency:
        return SafetyVerdict(
            emergency=True,
            level=4,
            triggered_keywords=(),
            vision_escalated=True,
            vision_downgrade_blocked=False,
        )

    # No red flags, no vision escalation. Use the text-level result.
    final_level = max(1, min(4, text_level))
    return SafetyVerdict(
        emergency=(final_level >= 4),
        level=final_level,
        triggered_keywords=(),
        vision_escalated=False,
        vision_downgrade_blocked=False,
    )


__all__ = [
    "RED_FLAG_KEYWORDS",
    "SafetyVerdict",
    "enforce_red_flag_safety",
]
