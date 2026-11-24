"""Phase 3 tests: knowledge engine (ingest/retrieve/verify) + financial ETL,
plus the grounding-enforced vision cascade and the financial "as of" label.

Fully deterministic and offline: PDF text extraction and LLM calls are
stubbed; no network, no keys, no models downloaded.
"""
from __future__ import annotations

import json
import sys
import tempfile
from datetime import date
from pathlib import Path
from unittest import mock

import pytest
from sqlalchemy import func, select

from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.models.government_cost import GovernmentCost
from app.models.knowledge import DocumentRegistry, KnowledgeChunk
from app.services.rag import chunker, embeddings, ingest, retriever, verifier
from app.services import etl_financial

# ---------------------------------------------------------------------------
# Chunker
# ---------------------------------------------------------------------------


def test_chunker_splits_on_headings_with_stable_ids():
    text = (
        "CHAPTER 1 Assessment\n"
        + ("Fever in a child under five needs urgent review. " * 30)
        + "\nSECTION 2 Management\n"
        + ("Give fluids and refer when danger signs appear. " * 30)
    )
    chunks = chunker.chunk_document(text, source_name="who_test.pdf")
    assert len(chunks) >= 2
    ids = [c.chunk_id for c in chunks]
    assert len(set(ids)) == len(ids)
    assert any("chapter 1" in c.section_path.lower() or "assessment" in c.section_path.lower() for c in chunks)
    assert all(c.text.strip() for c in chunks)


def test_chunker_never_raises_on_garbage():
    assert chunker.chunk_document("", source_name="empty.pdf") == []
    assert chunker.chunk_document("   \n\n ", source_name="ws.pdf") == []


# ---------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------


def test_hash_embeddings_are_deterministic_and_unit_norm():
    a = embeddings.embed_texts(["chest pain and breathlessness"])[0]
    b = embeddings.embed_texts(["chest pain and breathlessness"])[0]
    assert a == b
    assert len(a) == settings.EMBEDDING_DIM
    assert abs(sum(v * v for v in a) - 1.0) < 1e-6


def test_hash_embeddings_rank_related_text_higher():
    q = embeddings.embed_texts(["fever cough"])[0]
    close = embeddings.embed_texts(["high fever with cough"])[0]
    far = embeddings.embed_texts(["tax filing deadline finance"])[0]
    assert embeddings.cosine(q, close) > embeddings.cosine(q, far)


# ---------------------------------------------------------------------------
# Idempotent ingestion
# ---------------------------------------------------------------------------


async def _ingest_text(db, tmp_path: Path, name: str, text: str) -> dict:
    p = tmp_path / name
    # Bytes must reflect the stubbed content — the registry's idempotency
    # key is the SHA-256 of the file bytes, not the extracted text.
    p.write_bytes(text.encode("utf-8"))
    with mock.patch.object(ingest, "_extract_pdf_text", return_value=text):
        return await ingest.ingest_file(db, p, corpus="clinical")


@pytest.mark.asyncio
async def test_ingest_skips_unchanged_files_by_hash():
    text = "HEADING\n" + "fever triage guidance for children. " * 40
    async with AsyncSessionLocal() as db:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            first = await _ingest_text(db, tmp_path, "doc_a.pdf", text)
            assert first["status"] == "ingested"
            assert first["chunks"] >= 1

            second = await _ingest_text(db, tmp_path, "doc_a.pdf", text)
            assert second["status"] == "skipped-unchanged"

            count = (
                await db.execute(select(func.count()).select_from(DocumentRegistry))
            ).scalar()
            assert count == 1


@pytest.mark.asyncio
async def test_ingest_replaces_changed_document():
    async with AsyncSessionLocal() as db:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            await _ingest_text(db, tmp_path, "doc_b.pdf", "INITIAL\n" + "v1 content here. " * 40)
            v2 = await _ingest_text(db, tmp_path, "doc_b.pdf", "INITIAL\n" + "v2 revised guidance text. " * 50)
            assert v2["status"] == "ingested"
            names = (
                await db.execute(
                    select(DocumentRegistry).where(DocumentRegistry.filename == "doc_b.pdf")
                )
            ).scalars().all()
            assert len(names) == 1  # replaced, not duplicated
            assert names[0].chunk_count == v2["chunks"]


# ---------------------------------------------------------------------------
# Retrieval (hybrid + abstention)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_retrieval_finds_relevant_chunk_and_abstains_on_gibberish():
    clinical = (
        "SKIN CONDITIONS\n"
        + "rash blisters itching skin infection red patches on the body. " * 60
    )
    async with AsyncSessionLocal() as db:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            await _ingest_text(db, tmp_path, "skin_guidelines.pdf", clinical)
            await _ingest_text(
                db, tmp_path, "unrelated.pdf",
                "CORPORATE TAX\n" + "filing return ledger reconciliation. " * 60,
            )
            await db.commit()
        retriever.invalidate_corpus_index()
        hits = await retriever.search_corpus(db, "skin rash and itching on arm")
        assert hits, "relevant query returned nothing"
        assert any("skin" in h.source_name for h in hits)
        assert all(h.score > 0 for h in hits)

        nothing = await retriever.search_corpus(db, "zxqw vbtkp lorem")
        assert nothing == []  # abstention path


@pytest.mark.asyncio
async def test_retrieval_empty_corpus_returns_empty():
    async with AsyncSessionLocal() as db:
        await db.execute(KnowledgeChunk.__table__.delete())
        await db.commit()
        retriever.invalidate_corpus_index()
        assert await retriever.search_corpus(db, "fever", corpus="clinical") == []


# ---------------------------------------------------------------------------
# Grounding verifier
# ---------------------------------------------------------------------------


def test_verifier_rejects_hallucinated_citation():
    check = verifier.verify_grounding(
        grounding_reference="nonexistent#c9999",
        retrieved_chunk_ids=["doc#c0000"],
        claimed_reason="rash is visible with blisters",
        cited_chunk_text=None,
    )
    assert check.ok is False
    assert check.reason == "citation_not_retrieved"


def test_verifier_rejects_low_overlap_and_accepts_grounded():
    chunk_text = "Skin rash with blisters and itching indicates a dermatological condition review."
    bad = verifier.verify_grounding(
        grounding_reference="doc#c0000",
        retrieved_chunk_ids=["doc#c0000"],
        claimed_reason="tax filing ledger mismatch detected",
        cited_chunk_text=chunk_text,
    )
    assert bad.ok is False

    good = verifier.verify_grounding(
        grounding_reference="doc#c0000",
        retrieved_chunk_ids=["doc#c0000"],
        claimed_reason="rash with blisters skin condition indicates review",
        cited_chunk_text=chunk_text,
    )
    assert good.ok is True


# ---------------------------------------------------------------------------
# Vision cascade with grounding enforcement
# ---------------------------------------------------------------------------


class _FakeMessage:
    def __init__(self, content):
        self.content = content


class _FakeChoice:
    def __init__(self, content):
        self.message = _FakeMessage(content)


class _FakeResponse:
    def __init__(self, content):
        self.choices = [_FakeChoice(content)]


def _fake_litellm(payload_factory):
    """A minimal in-test stand-in for the litellm module."""

    class FakeModule:
        async def acompletion(self, model=None, api_key=None, messages=None, **kwargs):
            return _FakeResponse(payload_factory())

    return FakeModule()


async def _seed_skin_corpus():
    clinical = (
        "SKIN\n"
        "rash blisters itching skin infection red patches treatment guidance. " * 60
    )
    async with AsyncSessionLocal() as db:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            await _ingest_text(db, tmp_path, "skin_guidelines.pdf", clinical)
        await db.commit()  # ingest_file flushes; sessions must commit to persist
    retriever.invalidate_corpus_index()


@pytest.mark.asyncio
async def test_vision_grounded_output_is_verified_and_passes(monkeypatch):
    await _seed_skin_corpus()
    payload = {
        "visual_symptom_category": "unknown",
        "visual_urgency_signal": "non_serious",
        "confidence": 70,
        "reason": "rash with itching indicates skin condition review",
        "grounding_reference": "skin_guidelines#c0000",
    }
    fake = _fake_litellm(lambda: json.dumps(payload))
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    monkeypatch.setattr(settings, "NVIDIA_API_KEY", "")

    # Make sure *some* chunk is retrievable even if chunk_id naming shifts.
    async with AsyncSessionLocal() as db:
        retriever.invalidate_corpus_index()
        hits = await retriever.search_corpus(db, "rash itching skin")
        assert hits, "corpus chunk not retrievable - fixture broken"
    payload["grounding_reference"] = hits[0].chunk_id

    with mock.patch.dict(sys.modules, {"litellm": fake}):
        from app.services.vision_service import analyze_image

        signal = await analyze_image(
            image_bytes=b"fake-image-bytes-unique-1", mime_type="image/png",
            symptoms_text="rash and itching",
        )
    assert signal.model_version.startswith("cascade.")
    assert signal.grounding_verified is True
    assert signal.grounding_reference == hits[0].chunk_id


@pytest.mark.asyncio
async def test_vision_hallucinated_citation_falls_back_to_uncertain(monkeypatch):
    await _seed_skin_corpus()
    payload = {
        "visual_symptom_category": "unknown",
        "visual_urgency_signal": "non_serious",
        "confidence": 90,
        "reason": "made up citation",
        "grounding_reference": "hallucinated#c4242",
    }
    fake = _fake_litellm(lambda: json.dumps(payload))
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    monkeypatch.setattr(settings, "NVIDIA_API_KEY", "")

    with mock.patch.dict(sys.modules, {"litellm": fake}):
        from app.services.vision_service import analyze_image

        signal = await analyze_image(
            image_bytes=b"fake-image-bytes-unique-2", mime_type="image/png",
            symptoms_text="rash and itching",
        )
    # Grounding failure is a cascade-stage failure: all providers rejected,
    # so the output is the safe, never-guessed fallback.
    assert signal.visual_urgency_signal == "uncertain"
    assert signal.confidence == 0
    assert signal.model_version == "cascade.failed"


@pytest.mark.asyncio
async def test_vision_results_are_not_cached(monkeypatch):
    """Phase 3 item B5: patient image analyses must not be retained. Two
    identical calls must each hit the provider — a cache would hide that."""
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    monkeypatch.setattr(settings, "NVIDIA_API_KEY", "")

    calls = {"n": 0}

    class CountingLitellm:
        async def acompletion(self, **kwargs):
            calls["n"] += 1
            return _FakeResponse(
                json.dumps(
                    {
                        "visual_symptom_category": "unknown",
                        "visual_urgency_signal": "uncertain",
                        "confidence": 50,
                    }
                )
            )

    with mock.patch.dict(sys.modules, {"litellm": CountingLitellm()}):
        from app.services.vision_service import analyze_image

        a = await analyze_image(image_bytes=b"same-bytes", mime_type="image/png", symptoms_text="itchy skin")
        b = await analyze_image(image_bytes=b"same-bytes", mime_type="image/png", symptoms_text="itchy skin")
    assert a is not None and b is not None
    assert calls["n"] == 2, "vision result was cached — privacy regression"


# ---------------------------------------------------------------------------
# Financial ETL
# ---------------------------------------------------------------------------


def test_date_parser_is_honest():
    assert etl_financial.parse_effective_date("2026-01-15") == date(2026, 1, 15)
    assert etl_financial.parse_effective_date("not a date") is None
    assert etl_financial.parse_effective_date(None) is None
    assert etl_financial.parse_effective_date("") is None


def test_extraction_parser_salvages_truncated_json_array():
    # A max_tokens-truncated array (missing closing ]) must still yield every
    # complete object and drop the torn trailing one.
    truncated = (
        '[{"procedure_key": "a", "amount_inr": 100, "grounding_quote": "q1"}, '
        '{"procedure_key": "b", "amount_inr": 200, "grounding_quote": "q2"}, '
        '{"procedure_key": "c", "amount_inr": 30'
    )
    rows = etl_financial._parse_extracted_rows(truncated)
    assert rows is not None and len(rows) == 2
    assert [r["procedure_key"] for r in rows] == ["a", "b"]


def test_extraction_parser_accepts_wrapper_and_line_delimited():
    assert etl_financial._parse_extracted_rows('{"rows": [{"a": 1}, {"a": 2}]}') == [{"a": 1}, {"a": 2}]
    assert etl_financial._parse_extracted_rows('[{"a": 1}]') == [{"a": 1}]
    assert etl_financial._parse_extracted_rows('{"a": 1}\n{"a": 2}') == [{"a": 1}, {"a": 2}]
    assert etl_financial._parse_extracted_rows("no structure here at all") is None


async def _run_etl_with(db, tmp_path: Path, files: dict[str, str], candidates_map):
    """Run the ETL with stubbed file text and stubbed LLM extraction."""
    for name, text in files.items():
        # Distinct bytes per file so the registry's SHA-256 dedup behaves
        # like it would on real distinct documents.
        (tmp_path / name).write_bytes(f"{name}\n{text}".encode("utf-8"))

    def fake_text(path: Path):
        return files[path.name]

    async def fake_extract(source_text: str):
        # find which file this text came from
        for name, text in files.items():
            if source_text == text:
                return candidates_map.get(name)
        return None

    with mock.patch.object(ingest, "_extract_pdf_text", side_effect=lambda p: fake_text(p)), \
         mock.patch.object(etl_financial, "_read_document_text", side_effect=fake_text), \
         mock.patch.object(etl_financial, "_extract_rows_with_llm", side_effect=fake_extract):
        return await etl_financial.run_financial_etl(db, tmp_path)


@pytest.mark.asyncio
async def test_etl_recency_resolution_prefers_later_date():
    async with AsyncSessionLocal() as db:
        await db.execute(GovernmentCost.__table__.delete())
        await db.execute(DocumentRegistry.__table__.delete())
        await db.commit()

        old_text = "CGHS 2024 LIST\nprocedure: dialysis session Rs 1500 per session. Effective 2024-01-15."
        new_text = "CGHS 2026 LIST\nprocedure: dialysis session Rs 2100 per session. Effective 2026-01-15."
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            report = await _run_etl_with(
                db,
                tmp_path,
                {"cghs_2024.pdf": old_text, "cghs_2026.pdf": new_text},
                {
                    "cghs_2024.pdf": [
                        {
                            "procedure_key": "dialysis session",
                            "amount_inr": 1500,
                            "grounding_quote": "dialysis session Rs 1500 per session",
                            "effective_date": "2024-01-15",
                        }
                    ],
                    "cghs_2026.pdf": [
                        {
                            "procedure_key": "dialysis session",
                            "amount_inr": 2100,
                            "grounding_quote": "dialysis session Rs 2100 per session",
                            "effective_date": "2026-01-15",
                        }
                    ],
                },
            )
        assert report["status"] == "ok"

        rows = (
            await db.execute(
                select(GovernmentCost).where(
                    GovernmentCost.procedure_key == "dialysis session"
                )
            )
        ).scalars().all()
        active = [r for r in rows if r.active]
        assert len(rows) == 2
        assert len(active) == 1
        assert active[0].amount_inr == 2100
        assert active[0].effective_date == date(2026, 1, 15)


@pytest.mark.asyncio
async def test_etl_rejects_unverified_quote_and_flags_missing_dates():
    async with AsyncSessionLocal() as db:
        await db.execute(GovernmentCost.__table__.delete())
        await db.execute(DocumentRegistry.__table__.delete())
        await db.commit()

        text = "CT scan head cost Rs 2000 per test. No date printed."
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            await _run_etl_with(
                db,
                tmp_path,
                {"hospital_rates.pdf": text},
                {
                    "hospital_rates.pdf": [
                        {  # quote is NOT in the source text -> must be rejected
                            "procedure_key": "ct scan invented",
                            "amount_inr": 9999,
                            "grounding_quote": "this sentence does not exist anywhere",
                            "effective_date": "2026-01-01",
                        },
                        {  # valid quote but NO date -> honest flag, not a guess
                            "procedure_key": "ct scan head",
                            "amount_inr": 2000,
                            "grounding_quote": "CT scan head cost Rs 2000 per test",
                            "effective_date": None,
                        },
                    ]
                },
            )
        rows = (await db.execute(select(GovernmentCost))).scalars().all()
        keys = {r.procedure_key: r for r in rows}
        assert "ct scan invented" not in keys  # rejected outright
        flagged = keys["ct scan head"]
        assert flagged.needs_manual_confirmation is True
        assert flagged.effective_date is None  # never an invented date


@pytest.mark.asyncio
async def test_etl_second_run_is_idempotent():
    async with AsyncSessionLocal() as db:
        await db.execute(GovernmentCost.__table__.delete())
        await db.execute(DocumentRegistry.__table__.delete())
        await db.commit()
        text = "PHC consultation Rs 50 per visit. Effective 2024-01-01."
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            files = {"phc_rates.pdf": text}
            candidates = {
                "phc_rates.pdf": [
                    {
                        "procedure_key": "phc consultation",
                        "amount_inr": 50,
                        "grounding_quote": "PHC consultation Rs 50 per visit",
                        "effective_date": "2024-01-01",
                    }
                ]
            }
            first = await _run_etl_with(db, tmp_path, files, candidates)
            second = await _run_etl_with(db, tmp_path, files, candidates)
        assert first["status"] == "ok" and second["status"] == "ok"
        assert second["documents"][0]["result"] == "skipped-unchanged"
        count = (
            await db.execute(
                select(func.count())
                .select_from(GovernmentCost)
                .where(GovernmentCost.procedure_key == "phc consultation")
            )
        ).scalar()
        assert count == 1


# ---------------------------------------------------------------------------
# Financial "as of" freshness label on the cost endpoint
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_cost_estimate_always_carrier_freshness_label(client):
    from app.core.limiter import limiter

    limiter.reset()
    resp = await client.post(
        "/api/cost/estimate",
        json={"hospitalId": "aiims-delhi", "diseaseId": "dengue", "severity": "mild"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["as_of"]  # non-empty label, always
