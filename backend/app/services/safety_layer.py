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
  keyword list (primarily English, plus clinically reviewed Hindi and
  Bengali entries). Broader multilingual red-flag coverage is the
  responsibility of the upstream category classifier; this module is the
  last-mile safety net.
- Matching is evasion-hardened: input is Unicode-normalized (NFC),
  stripped of zero-width characters, and whitespace-collapsed, and also
  matched in a fully space-stripped form. This strictly WIDENS detection
  — it can only catch at least as much as the plain substring scan it
  replaces, never less, and it never changes the escalation rules below.
- Returns a structured `SafetyVerdict` — never raises.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

# Zero-width / invisible formatting characters used to evade keyword scans.
_ZERO_WIDTH_CHARS = ("\u200b", "\u200c", "\u200d", "\ufeff")
_WHITESPACE_RUN = re.compile(r"\s+")


def _match_forms(text: str) -> tuple[str, str]:
    """Return (normalized, fully space-stripped) forms of `text` for matching.

    Normalization composes NFC, strips zero-width characters, lowercases,
    and collapses whitespace runs. The second form removes all spaces so
    letter-spaced evasions ('c h e s t pain') still match keywords.
    This only ever WIDENS detection versus a plain substring scan.
    """
    t = unicodedata.normalize("NFC", text)
    for zw in _ZERO_WIDTH_CHARS:
        t = t.replace(zw, "")
    t = _WHITESPACE_RUN.sub(" ", t).strip().lower()
    return t, t.replace(" ", "")


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
    "choking",
    "drowning",
)

RED_FLAG_PATTERNS: tuple[re.Pattern, ...] = (
    # English emergency patterns
    re.compile(r"\b(bleed(ing)?\s+heavily|heavy\s+bleed(ing)?|severe\s+bleed(ing)?)\b", re.I),
    re.compile(r"\b(postpartum|delivery)\b.*\b(bleed|haemorrhage|hemorrhage|stop)\b", re.I),
    re.compile(r"\b(kerosene|phenyl|rat\s*poison|pesticide|swallowed\s+poison)\b", re.I),
    re.compile(r"\b(bitten\s+by\s+(a\s+)?snake|snake\s*bite|fang\s*marks?)\b", re.I),
    re.compile(r"\bnot\s+responding\b", re.I),
    re.compile(r"\b(sudden\s+collapse|no\s+pulse)\b", re.I),
    re.compile(r"\b(crushing\s+chest\s+pain|chest\s+pain)\b", re.I),
    re.compile(r"\b(cannot|can't)\s+breathe\b", re.I),
    re.compile(r"\b(lips?\s+(are\s+)?turning\s+blue|blue\s+lips?)\b", re.I),
    re.compile(r"\b(having\s+a\s+seizure|convulsion|fits?\s+aa\s+rah)\b", re.I),
    re.compile(r"\b(facial\s+droop|face\s+droop(ing)?|slurred\s+speech)\b", re.I),

    # Hindi Devanagari patterns
    re.compile(r"सीने\s*में\s*([^।,.!?]{0,25})\s*दर्द", re.UNICODE),
    re.compile(r"छाती\s*में\s*([^।,.!?]{0,25})\s*दर्द", re.UNICODE),
    re.compile(r"सांस\s*(नहीं|नही)\s*आ\s*रही", re.UNICODE),
    re.compile(r"सांस\s*लेने\s*में\s*(दिक्कत|तकलीफ|परेशानी)", re.UNICODE),
    re.compile(r"होंठ\s*नीले", re.UNICODE),
    re.compile(r"दौरा\s*पड़", re.UNICODE),
    re.compile(r"बेहोश", re.UNICODE),
    re.compile(r"सांप\s*(ने\s*)?काटा|सांप\s*का\s*काटना", re.UNICODE),
    re.compile(r"खून\s*(बह\s*रहा|निकल\s*रहा)", re.UNICODE),

    # Hindi Transliterated (Hinglish) patterns
    re.compile(r"seen[ea]\s*me(in)?\s*([a-z\s]{0,20})\s*dard", re.I),
    re.compile(r"chhati\s*me(in)?\s*([a-z\s]{0,20})\s*dard", re.I),
    re.compile(r"sa+ns?\s*(nahi|nhi)\s*aa?\s*rahi", re.I),
    re.compile(r"sa+ns?\s*l[ea]n[ea]\s*m[ea](in)?\s*(dikkat|takleef|problem)", re.I),
    re.compile(r"daura\s*pad\s*raha", re.I),
    re.compile(r"behosh", re.I),
    re.compile(r"fits?\s*aa\s*rah[ei]", re.I),
    re.compile(r"saanp\s*(ne\s*)?kaat", re.I),

    # Bengali patterns
    re.compile(r"বুকে\s*([^।,.!?]{0,25})\s*ব্যথা", re.UNICODE),
    re.compile(r"বুকের\s*([^।,.!?]{0,25})\s*ব্যথা", re.UNICODE),
    re.compile(r"শ্বাস\s*নিতে\s*পারছি\s*না", re.UNICODE),
    re.compile(r"শ্বাসকষ্ট", re.UNICODE),
    re.compile(r"ঠোঁট\s*নীল", re.UNICODE),
    re.compile(r"অতিরিক্ত\s*রক্তপাত", re.UNICODE),
    re.compile(r"প্রসবের\s*পর.*রক্তপাত", re.UNICODE),
    re.compile(r"সাপে\s*কাটা|সাপের\s*কামড়", re.UNICODE),
    re.compile(r"অজ্ঞান|নিস্তেজ", re.UNICODE),

    # Bengali Transliterated patterns
    re.compile(r"buk[ea]r?\s*([a-z\s]{0,20})\s*by?atha", re.I),
    re.compile(r"shash\s*nite\s*parchhi\s*na|shas\s*nite\s*parchi\s*na", re.I),
    re.compile(r"rokto\s*pat", re.I),
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
    """Substring scan + regex pattern scan over the user's symptoms text.

    Evasion-hardened: the text is matched in both its normalized form and
    a fully space-stripped form, so zero-width characters and letter-spaced
    obfuscation cannot bypass detection.
    """
    if not text:
        return False, ()
    hay, hay_squashed = _match_forms(text)
    kw_hits = [
        kw
        for kw in RED_FLAG_KEYWORDS
        if (lambda k_forms: k_forms[0] in hay or k_forms[1] in hay_squashed)(
            _match_forms(kw)
        )
    ]
    pattern_hits = [
        p.pattern
        for p in RED_FLAG_PATTERNS
        if p.search(hay) or p.search(text)
    ]
    all_hits = tuple(dict.fromkeys(kw_hits + pattern_hits))
    return (len(all_hits) > 0), all_hits


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
