"""Deterministic adversarial coverage for the SwasthyaSetu AI backend.

All provider, scraper, and timeout behavior is mocked. This file must never
make a live Gemini, Groq, NVIDIA, Google Maps, or DuckDuckGo request.
"""

from __future__ import annotations

import asyncio
import json
import sys
import types
from types import SimpleNamespace

import pytest

from app.services import pricing_service, precision_service, v2_data
from app.services.provider_registry import get_cascade
from app.services.safety_layer import enforce_red_flag_safety
from app.services.v2_engine import run_triage_v3


@pytest.mark.asyncio
async def test_cascade_429_falls_through_gemini_groq_then_nvidia(monkeypatch):
    """A deterministic rate-limit cascade reaches the final provider."""

    calls: list[str] = []

    async def fake_acompletion(*, model, **_kwargs):
        calls.append(model)
        if model.startswith("gemini/") or model.startswith("nvidia_nim/"):
            raise RuntimeError("429 rate limit (simulated)")
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        content=json.dumps({"amount_inr": 12345, "confidence": 61})
                    )
                )
            ]
        )

    fake_litellm = types.SimpleNamespace(acompletion=fake_acompletion)
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)
    monkeypatch.setattr(pricing_service.settings, "GEMINI_API_KEY", "test-gemini")
    monkeypatch.setattr(pricing_service.settings, "GROQ_API_KEY", "test-groq")
    monkeypatch.setattr(pricing_service.settings, "NVIDIA_API_KEY", "test-nvidia")
    monkeypatch.setattr(pricing_service.settings, "ENABLE_WEB_SCRAPE", True)
    monkeypatch.setattr(
        pricing_service,
        "_scrape_cost_info",
        lambda *_args, **_kwargs: _resolved(["simulated cost snippet"]),
    )

    result = await pricing_service.get_price_estimate(
        disease_id=None,
        severity=None,
        query="simulated non-curated procedure",
        location="Delhi",
    )

    # 5D: models are registry-served and dynamic — assert against exactly
    # what the registry hands the cascade, never a hardcoded name list.
    from app.services.provider_registry import get_cascade

    expected = [m for _, m in get_cascade("text")]
    assert calls == expected
    assert result.source == pricing_service.COMMUNITY_SOURCE
    assert result.amount_inr == 12345
    assert result.confidence == 61


@pytest.mark.asyncio
async def test_scraper_timeout_is_strict_and_graceful(monkeypatch):
    """Scraper timeout is bounded at the prescribed 3.0 seconds (phase 1 item 1A)."""

    observed_timeout: list[float] = []

    async def fake_to_thread(_fn):
        await asyncio.sleep(10)
        return ["should never be returned"]

    async def fake_wait_for(awaitable, *, timeout):
        observed_timeout.append(timeout)
        awaitable.close()
        raise asyncio.TimeoutError

    monkeypatch.setattr(precision_service.asyncio, "to_thread", fake_to_thread)
    monkeypatch.setattr(precision_service.asyncio, "wait_for", fake_wait_for)

    result = await precision_service.get_verified_sources("simulated timeout")

    assert observed_timeout == [3.0]
    assert result == []


@pytest.mark.asyncio
async def test_payload_poisoning_returns_422_not_500(client):
    """Malformed, oversized, and structurally invalid JSON never becomes 500."""

    invalid = {"unexpected": {"nested": "x" * 60000}}
    post_paths = [
        "/api/triage/analyze",
        "/api/triage/emergency-route",
        "/api/cost/estimate",
        "/api/cost/alternatives",
        "/api/insurance/analyze-policy",
        "/api/schemes/match",
        "/api/facilities/search",
        "/api/facilities/advanced-search",
    ]

    for path in post_paths:
        response = await client.post(path, json=invalid)
        assert response.status_code == 422, (path, response.status_code, response.text)

    corrupted = await client.post(
        "/api/triage/analyze",
        content="{ definitely-not-json",
        headers={"content-type": "application/json"},
    )
    assert corrupted.status_code == 422


@pytest.mark.asyncio
async def test_red_flag_override_is_final_authority():
    """An ambiguous red flag stays emergency even with a non-serious vision signal."""

    result = run_triage_v3(
        text="Maybe indigestion, but there is chest pain and sweating after walking.",
        flags=[],
        vision_signal={
            "visual_symptom_category": "unknown",
            "visual_urgency_signal": "non_serious",
            "confidence": 99,
        },
    )

    assert result["emergency"] is True
    assert result["level"] == 4
    assert result["safety_audit"]["vision_downgrade_blocked"] is True
    assert "chest pain" in result["safety_audit"]["triggered_keywords"]


def test_vision_emergency_signal_can_only_escalate():
    """A vision emergency signal escalates a benign text pathway."""

    result = run_triage_v3(
        text="A small itchy rash on the forearm.",
        flags=[],
        vision_signal={
            "visual_symptom_category": "unknown",
            "visual_urgency_signal": "emergency",
            "confidence": 80,
        },
    )

    assert result["emergency"] is True
    assert result["level"] == 4
    assert result["safety_audit"]["vision_escalated"] is True


@pytest.mark.asyncio
async def test_curated_pricing_outranks_scrape_and_llm(monkeypatch):
    """A curated disease/severity price never reaches scrape or LLM fallback."""

    async def forbidden_scrape(*_args, **_kwargs):
        raise AssertionError("curated lookup must prevent scraper access")

    async def forbidden_llm(*_args, **_kwargs):
        raise AssertionError("curated lookup must prevent LLM access")

    monkeypatch.setattr(pricing_service, "_scrape_cost_info", forbidden_scrape)
    monkeypatch.setattr(pricing_service, "_extract_price_with_llm", forbidden_llm)
    monkeypatch.setattr(pricing_service.settings, "ENABLE_WEB_SCRAPE", True)

    disease = v2_data.DISEASES[0]
    expected = disease["base"][v2_data.SEVERITY_INDEX["mild"]]
    result = await pricing_service.get_price_estimate(
        disease_id=disease["id"], severity="mild", query="hostile override", location="Delhi"
    )

    assert result.source == pricing_service.VERIFIED_SOURCE
    assert result.amount_inr == expected
    assert result.confidence == 95


def _resolved(value):
    async def _inner(*_args, **_kwargs):
        return value

    return _inner()


@pytest.mark.parametrize("localized_text", ["सीने में दर्द और पसीना", "বুকের ব্যথা এবং ঘাম"])
def test_existing_localized_chest_pain_phrases_force_emergency(localized_text):
    """Project-owned Hindi/Bengali cardiac phrases cannot be downgraded."""

    verdict = enforce_red_flag_safety(
        symptoms_text=localized_text,
        frontend_flags=[],
        text_level=1,
        visual_urgency_signal="non_serious",
    )

    assert verdict.emergency is True
    assert verdict.level == 4
    assert verdict.vision_downgrade_blocked is True


@pytest.mark.asyncio
async def test_cascade_one_second_timeout_falls_through_to_nvidia(monkeypatch):
    """A provider that exceeds one second is abandoned and the cascade continues."""

    calls: list[str] = []

    async def fake_acompletion(*, model, **_kwargs):
        calls.append(model)
        if model.startswith("gemini/"):
            await asyncio.sleep(1.1)
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        content=json.dumps({"amount_inr": 24680, "confidence": 72})
                    )
                )
            ]
        )

    fake_litellm = types.SimpleNamespace(acompletion=fake_acompletion)
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)
    monkeypatch.setattr(pricing_service.settings, "GEMINI_API_KEY", "test-gemini")
    monkeypatch.setattr(pricing_service.settings, "GROQ_API_KEY", "")
    monkeypatch.setattr(pricing_service.settings, "NVIDIA_API_KEY", "test-nvidia")

    result = await asyncio.wait_for(
        pricing_service._extract_price_with_llm(["simulated snippet"]),
        timeout=3.0,
    )

    assert calls == [m for _, m in get_cascade("text") if m]
    assert result.source == pricing_service.COMMUNITY_SOURCE
    assert result.amount_inr == 24680
    assert result.confidence == 72


@pytest.mark.asyncio
async def test_advanced_search_rate_limit_blocks_after_ten_requests(client):
    """The per-IP 10/minute route limit returns 429 rather than 500."""

    from app.core.limiter import limiter

    limiter.reset()
    payload = {"cityId": "delhi", "filters": {}, "query": "", "sort": "near"}
    responses = [
        await client.post(
            "/api/facilities/advanced-search?include_pricing=false",
            json=payload,
        )
        for _ in range(12)
    ]

    assert any(response.status_code == 429 for response in responses)
    assert all(response.status_code != 500 for response in responses)


@pytest.mark.asyncio
async def test_sql_like_identifier_strings_return_422(client):
    """Identifier fields reject SQL-like strings across every routed variant."""

    bad = "' OR 1=1 --"
    cases = [
        ("/api/triage/emergency-route", {"cityId": bad, "count": 4}),
        (
            "/api/cost/estimate",
            {"hospitalId": bad, "diseaseId": "cardiac", "severity": "mild"},
        ),
        (
            "/api/cost/alternatives",
            {"cityId": bad, "diseaseId": "cardiac", "severity": "mild"},
        ),
        (
            "/api/insurance/analyze-policy",
            {"coverage": 500000, "type": bad, "networkIds": []},
        ),
        (
            "/api/schemes/match",
            {
                "state": bad,
                "income": 1,
                "category": "cat.general",
                "work": "work.farmer",
                "need": "need.general",
            },
        ),
        (
            "/api/facilities/search",
            {"cityId": bad, "filters": {}, "query": "", "sort": "near"},
        ),
        (
            "/api/facilities/advanced-search",
            {"cityId": bad, "filters": {}, "query": "", "sort": "near"},
        ),
    ]

    for path, payload in cases:
        response = await client.post(path, json=payload)
        assert response.status_code == 422, (path, response.status_code, response.text)


@pytest.mark.asyncio
async def test_sql_like_symptom_free_text_is_not_an_internal_error(client, monkeypatch):
    """Symptoms are intentionally free text, but SQL-like content must not 500."""

    async def fake_precision(_query: str) -> dict:
        return {"verified_sources": [], "disclaimer": "test"}

    from app.services import precision_service

    monkeypatch.setattr(precision_service, "apply_precision", fake_precision)
    response = await client.post(
        "/api/triage/analyze",
        json={"symptoms": "pain'); DROP TABLE triage; --", "flags": []},
    )

    assert response.status_code == 200
    assert response.json()["emergency"] is False
