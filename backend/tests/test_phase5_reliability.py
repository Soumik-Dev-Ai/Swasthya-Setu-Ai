"""Phase 5 AI-reliability tests (doc 09 §9 / doc 12).

Hedging/negation adversarial inputs (B.7) and eligibility boundary fuzzing
(A.4). The deterministic safety gate is expected to *over*-trigger on
negated red flags — that is the documented "fail toward caution" guarantee,
not a defect.
"""
from __future__ import annotations

import pytest

from app.services import v2_engine
from app.services.safety_layer import enforce_red_flag_safety

# ---------------------------------------------------------------------------
# Hedging / negation (doc 12 §B.7)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text,expected_keyword",
    [
        ("I don't think it's serious but I have chest pain", "chest pain"),
        ("probably not a heart attack but my chest hurts", "heart attack"),
        ("he said it's just anxiety, not a stroke", "stroke"),
        ("maybe nothing, but I can't breathe properly", "can't breathe"),
    ],
)
def test_hedged_red_flags_still_force_emergency(text, expected_keyword):
    verdict = enforce_red_flag_safety(
        symptoms_text=text, frontend_flags=[], text_level=1, visual_urgency_signal=None
    )
    assert verdict.emergency is True and verdict.level == 4
    assert expected_keyword in verdict.triggered_keywords


# ---------------------------------------------------------------------------
# Eligibility boundary fuzzing (doc 12 §A.4)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("income", [0, 1, 5000, 12000, 25000, 48000, 60000, 80000, 100000, 120000, 500000, -5])
@pytest.mark.asyncio
async def test_scheme_matcher_survives_income_boundaries(income):
    """Every income — including 0 and negative (weird-but-valid input) —
    returns a deterministic list, never raises."""
    result = await v2_engine.match_schemes(
        {"state": "west_bengal", "income": income, "category": "gen",
         "work": "farmer", "need": "need.general"}
    )
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_scheme_matcher_is_deterministic():
    profile = {"state": "west_bengal", "income": 10000, "category": "sc",
               "work": "labourer", "need": "need.general"}
    assert await v2_engine.match_schemes(profile) == await v2_engine.match_schemes(profile)


@pytest.mark.asyncio
async def test_scheme_matcher_low_income_broadens_pmjay_eligibility():
    """The scheme matcher uses enumerated bands (not raw rupees): income 0
    (no means) or a reserved-category low band must surface PM-JAY, while a
    non-subsidised band must not."""
    destitute = await v2_engine.match_schemes(
        {"state": "wb", "income": 0, "category": "cat.gen", "work": "work.daily", "need": "need.general"}
    )
    reserved = await v2_engine.match_schemes(
        {"state": "wb", "income": 1, "category": "cat.sc", "work": "work.daily", "need": "need.general"}
    )
    unsubsidised = await v2_engine.match_schemes(
        {"state": "wb", "income": 2, "category": "cat.gen", "work": "work.perm", "need": "need.general"}
    )
    names = lambda r: {s["scheme"].get("id") for s in r}
    assert "pmjay" in names(destitute)
    assert "pmjay" in names(reserved)
    assert "pmjay" not in names(unsubsidised)