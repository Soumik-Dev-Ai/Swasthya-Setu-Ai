"""The CI-gated adversarial safety suite for the deterministic safety gate.

This file is the merge-blocking artifact called for by:
- docs/01_AUDIT_KEEP_KILL.md findings #4 and #18 (no untested safety edits,
  and multilingual adversarial coverage)
- docs/04_AI_SAFETY_ETHICS.md §3 (the exact escalation ruleset)
- docs/09_QA_TEST_PLAN.md §4 (adversarial categories: multilingual,
  evasion, override blocking)

It runs WITHOUT any network, LLM, or database dependency. If any test in
this file fails, the CI safety-tests job fails and nothing merges.

Known coverage boundary (tracked in CHANGELOG.md and QA plan §4):
transliteration attacks ("seene mein dard") and full multilingual keyword
parity are corpus-expansion work requiring the mandatory human clinical
review gate (docs/06 §3) — they are NOT silently faked here.
"""
from __future__ import annotations

import random
import string

import pytest

from app.services.safety_layer import (
    RED_FLAG_KEYWORDS,
    SafetyVerdict,
    enforce_red_flag_safety,
)

# --------------------------------------------------------------------------
# 1. Golden corpus integrity — an accidental edit that removes or renames a
#    keyword (audit #4's exact scenario) fails here before any merge.
# --------------------------------------------------------------------------

# Snapshot of the canonical, clinically-reviewed keyword list. Any diff
# against this is intentional-only and requires updating both in one PR.
CANONICAL_KEYWORDS = (
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


def test_keyword_corpus_is_exactly_the_canonical_reviewed_set():
    assert RED_FLAG_KEYWORDS == CANONICAL_KEYWORDS, (
        "The red-flag keyword corpus changed. Keyword edits require clinical "
        "review plus simultaneous update of this golden list (docs/01 #4)."
    )


def test_keyword_corpus_has_no_duplicates_or_empty_entries():
    assert len(set(RED_FLAG_KEYWORDS)) == len(RED_FLAG_KEYWORDS)
    assert all(kw.strip() for kw in RED_FLAG_KEYWORDS)


# --------------------------------------------------------------------------
# 2. Exhaustive positive coverage — EVERY keyword in isolation forces L4.
# --------------------------------------------------------------------------


@pytest.mark.parametrize("keyword", list(RED_FLAG_KEYWORDS))
def test_every_keyword_forces_level4_emergency(keyword: str):
    verdict = enforce_red_flag_safety(
        symptoms_text=f"I have {keyword} since morning",
        frontend_flags=[],
        text_level=1,
        visual_urgency_signal=None,
    )
    assert verdict.emergency is True
    assert verdict.level == 4
    assert keyword in verdict.triggered_keywords


# --------------------------------------------------------------------------
# 3. Case insensitivity, punctuation adjacency, surrounding noise.
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "CHEST PAIN",
        "Chest Pain",
        "cHeSt PaIn",
        "I think I have CHEST PAIN, please help.",
        "...stroke!",
        "UNCONSCIOUS and not responding",
    ],
)
def test_case_and_punctuation_variants_still_trigger(text: str):
    verdict = enforce_red_flag_safety(
        symptoms_text=text, frontend_flags=[], text_level=1, visual_urgency_signal=None
    )
    assert verdict.emergency is True and verdict.level == 4


# --------------------------------------------------------------------------
# 4. Evasion attacks — zero-width characters and letter-spacing
#    (docs/09 §2 Adversarial 1). These must NOT bypass the scanner.
# --------------------------------------------------------------------------

@pytest.mark.parametrize(
    "evasive",
    [
        "c​hest pain",
        "chest​ pain",
        "ch​est pa​in",
        "c h e s t p a i n",
        "c h e s t  pain",
        "s​nake bite",
        "hea​rt att​ack",
        "u n c o n s c i o u s",
    ],
)
def test_zero_width_and_spacing_evasion_is_still_detected(evasive: str):
    verdict = enforce_red_flag_safety(
        symptoms_text=evasive, frontend_flags=[], text_level=1, visual_urgency_signal=None
    )
    assert (
        verdict.emergency is True and verdict.level == 4
    ), f"evasive red-flag phrasing slipped through: {evasive!r}"


# --------------------------------------------------------------------------
# 5. Multilingual red flags (the reviewed non-English entries).
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text,expected_kw",
    [
        ("मुझे सीने में दर्द हो रहा है", "सीने में दर्द"),
        ("সারা রাত বুকের ব্যথা হচ্ছিল", "বুকের ব্যথা"),
        ("सीने में दर्द और पसीना आ रहा है", "सीने में दर्द"),
        ("হঠাৎ বুকের ব্যথা শুরু", "বুকের ব্যথা"),
    ],
)
def test_hindi_and_bengali_red_flags_force_emergency(text: str, expected_kw: str):
    verdict = enforce_red_flag_safety(
        symptoms_text=text, frontend_flags=[], text_level=1, visual_urgency_signal=None
    )
    assert verdict.emergency is True and verdict.level == 4
    assert expected_kw in verdict.triggered_keywords


# --------------------------------------------------------------------------
# 6. Benign language must NOT over-trigger (precise false-positive pin).
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "benign",
    [
        "mild headache since yesterday",
        "कल से सरदर्द है",  # Hindi: headache since yesterday
        "জ্বর নেই, শুধু কাশি",  # Bengali: no fever, only cough
        "small scratch on my knee",
        "sore throat and runny nose",
        "ocasional back ache after farming",
        "i slept badly and feel tired",
    ],
)
def test_benign_text_does_not_trigger_red_flag(benign: str):
    verdict = enforce_red_flag_safety(
        symptoms_text=benign, frontend_flags=[], text_level=2, visual_urgency_signal=None
    )
    assert verdict.emergency is False
    assert verdict.triggered_keywords == ()


# --------------------------------------------------------------------------
# 7. The override rules (docs/04 §3 — verified literally).
# --------------------------------------------------------------------------


def test_rule1_text_red_flag_cannot_be_downgraded_by_vision():
    v = enforce_red_flag_safety(
        symptoms_text="chest pain",
        frontend_flags=[],
        text_level=1,
        visual_urgency_signal="non_serious",
    )
    assert v.level == 4 and v.emergency is True
    assert v.vision_downgrade_blocked is True
    assert "chest pain" in v.triggered_keywords


def test_rule2_frontend_flag_alone_forces_emergency():
    v = enforce_red_flag_safety(
        symptoms_text="I feel a bit off",
        frontend_flags=["chest"],
        text_level=1,
        visual_urgency_signal="non_serious",
    )
    assert v.level == 4 and v.emergency is True
    assert v.vision_downgrade_blocked is True  # downgrade attempt blocked


def test_rule3_vision_emergency_escalates_clear_text():
    v = enforce_red_flag_safety(
        symptoms_text="slight rash on arm",
        frontend_flags=[],
        text_level=1,
        visual_urgency_signal="emergency",
    )
    assert v.level == 4 and v.emergency is True
    assert v.vision_escalated is True


def test_rule4_no_signals_trusts_text_level_and_clamps():
    v = enforce_red_flag_safety(
        symptoms_text="mild headache",
        frontend_flags=[],
        text_level=99,  # out of range must clamp to 4
        visual_urgency_signal=None,
    )
    assert v.level == 4 and v.emergency is True

    v2 = enforce_red_flag_safety(
        symptoms_text="mild headache",
        frontend_flags=[],
        text_level=-5,
        visual_urgency_signal=None,
    )
    assert v2.level == 1 and v2.emergency is False


def test_rule5_uncertain_vision_neither_escalates_nor_blocks():
    v = enforce_red_flag_safety(
        symptoms_text="mild headache",
        frontend_flags=[],
        text_level=2,
        visual_urgency_signal="uncertain",
    )
    assert v.level == 2 and v.emergency is False
    assert v.vision_escalated is False and v.vision_downgrade_blocked is False


# --------------------------------------------------------------------------
# 8. Determinism + never-raises fuzzing.
# --------------------------------------------------------------------------


def test_determinism_same_input_same_verdict():
    kwargs = dict(
        symptoms_text="chest pain and sweating",
        frontend_flags=[],
        text_level=2,
        visual_urgency_signal="non_serious",
    )
    a = enforce_red_flag_safety(**kwargs)
    b = enforce_red_flag_safety(**kwargs)
    assert a == b


def test_fuzz_never_raises_on_arbitrary_input():
    rng = random.Random(20260906)
    alphabet = string.printable + "सीनेदर्दবুকেরব্যথা🩺💊\x00​"
    for _ in range(500):
        text = "".join(rng.choice(alphabet) for _ in range(rng.randint(0, 300)))
        flags = ["x"] if rng.random() < 0.3 else []
        vision = rng.choice([None, "emergency", "non_serious", "uncertain", "garbage"])
        verdict = enforce_red_flag_safety(
            symptoms_text=text,
            frontend_flags=flags,
            text_level=rng.randint(-10, 99),
            visual_urgency_signal=vision,
        )
        assert isinstance(verdict, SafetyVerdict)
        assert 1 <= verdict.level <= 4


def test_oversized_input_processed_without_error():
    verdict = enforce_red_flag_safety(
        symptoms_text=("headache " * 20000) + "chest pain" + (" tired" * 20000),
        frontend_flags=[],
        text_level=1,
        visual_urgency_signal=None,
    )
    assert verdict.level == 4 and verdict.emergency is True
