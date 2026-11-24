"""Phase 3 text-path Reasoning Engine tests (doc 22 item 6).

Mirrors the vision-path coverage: grounded pass, hallucinated-citation
fall-through, red-flag deferral, no-keys degradation, and the live
opt-in endpoint. Fully deterministic via stubbed litellm.
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path
from unittest import mock

import pytest

from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.services import reasoning_engine
from app.services.rag import ingest, retriever


async def _seed(text: str, name: str = "fever_guide.pdf"):
    async with AsyncSessionLocal() as db:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            p = tmp_path / name
            p.write_bytes(text.encode("utf-8"))
            with mock.patch.object(ingest, "_extract_pdf_text", return_value=text):
                await ingest.ingest_file(db, p, corpus="clinical")
            await db.commit()
    retriever.invalidate_corpus_index()


class _Resp:
    def __init__(self, content):
        self.choices = [type("C", (), {"message": type("M", (), {"content": content})()})()]


def _litellm_stub(factory):
    class M:
        async def acompletion(self, **kw):
            return _Resp(factory())
    return M()


@pytest.mark.asyncio
async def test_reasoning_defers_to_gate_on_red_flag():
    res = await reasoning_engine.analyze_text("chest pain radiating")
    assert res.severity_signal == "emergency"
    assert res.model_version == "reasoning.deferred_to_gate"
    assert res.grounding_reference is None


@pytest.mark.asyncio
async def test_reasoning_grounded_output_verified(monkeypatch):
    await _seed(
        "FEVER\nfever cough fast breathing high temperature dengue danger signs. " * 60
    )
    # find a real retrievable chunk id
    async with AsyncSessionLocal() as db:
        hits = await retriever.search_corpus(db, "fever cough fast breathing")
        assert hits, "fixture not retrievable"
        chunk_id = hits[0].chunk_id

    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    monkeypatch.setattr(settings, "NVIDIA_API_KEY", "")
    payload = {
        "severity_signal": "non_serious",
        "finding_category": "febrile illness",
        "confidence": 60,
        "reason": "fever with cough fast breathing high temperature",
        "grounding_reference": chunk_id,
    }
    stub = _litellm_stub(lambda: json.dumps(payload))
    with mock.patch.dict(sys.modules, {"litellm": stub}):
        res = await reasoning_engine.analyze_text("fever and cough fast breathing")
    assert res.model_version.startswith("cascade.")
    assert res.grounding_verified is True
    assert res.grounding_reference == chunk_id


@pytest.mark.asyncio
async def test_reasoning_hallucinated_citation_falls_to_uncertain(monkeypatch):
    await _seed(
        "FEVER\nfever cough fast breathing high temperature dengue danger signs. " * 60
    )
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    monkeypatch.setattr(settings, "NVIDIA_API_KEY", "")
    payload = {
        "severity_signal": "non_serious",
        "finding_category": "x",
        "confidence": 99,
        "reason": "nonsense",
        "grounding_reference": "made-up#c999",
    }
    stub = _litellm_stub(lambda: json.dumps(payload))
    with mock.patch.dict(sys.modules, {"litellm": stub}):
        res = await reasoning_engine.analyze_text("fever and cough")
    assert res.severity_signal == "uncertain"
    assert res.model_version == "cascade.failed"
    assert res.grounding_verified is False


@pytest.mark.asyncio
async def test_reasoning_no_keys_degrades_cleanly(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    monkeypatch.setattr(settings, "NVIDIA_API_KEY", "")
    res = await reasoning_engine.analyze_text("mild headache")
    assert res.severity_signal == "uncertain"
    assert res.model_version == "reasoning.no_keys"


@pytest.mark.asyncio
async def test_reasoning_endpoint_deferred_on_red_flag(client):
    from app.core.limiter import limiter
    limiter.reset()
    resp = await client.post("/api/v3/reason", json={"text": "chest pain"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["deferred_to_gate"] is True
    assert body["emergency"] is True
    assert body["reasoning"]["severity_signal"] == "emergency"
    limiter.reset()


# ---------------------------------------------------------------------------
# doc 27 item 2 — endpoint behavior pinned: /v3/intent is routing + the
# deterministic symptom pipeline (no grounded reasoning); /triage/analyze's
# JSON body with `reasoning: true` is the single call that merges the
# deterministic result with the opt-in grounded Reasoning Engine.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_intent_endpoint_returns_deterministic_triage_not_reasoning(client):
    from app.core.limiter import limiter
    limiter.reset()
    resp = await client.post("/api/v3/intent", json={"text": "fever and cough", "flags": []})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["intent"] == "symptom"
    triage = body["data"]["triage_data"]
    assert "level" in triage and "matched" in triage
    # The routing endpoint does NOT run the grounded Reasoning Engine.
    assert "reasoning" not in triage
    assert "grounding_reference" not in triage
    limiter.reset()


@pytest.mark.asyncio
async def test_triage_analyze_json_reasoning_flag_present(client):
    from app.core.limiter import limiter
    limiter.reset()
    # No provider keys are set in tests, so reasoning degrades gracefully —
    # the key point is the opt-in field is honored and returned.
    resp = await client.post(
        "/api/triage/analyze",
        json={"symptoms": "fever and cough", "flags": [], "reasoning": True},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "level" in body
    assert "reasoning" in body
    limiter.reset()