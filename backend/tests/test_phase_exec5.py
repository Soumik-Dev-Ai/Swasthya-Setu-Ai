"""Phase execution prompt 5 — backend data alignment & safety hardening.

Real evidence per item:
- 5A: district_aggregates actually filters (referrals via Facility.district,
  triage via region) instead of returning global counts.
- 5B: Last-Write-Wins on both sync upserts (stale retransmission never
  clobbers a newer row; tz-normalized comparison survives SQLite's naive
  datetimes).
- 5E: a model that cites NONE of the retrieved guideline chunks is a cascade
  stage failure — never an accepted pass-through.
"""
from __future__ import annotations

import json
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.models.asha import AshaRecord
from app.models.facility import Facility
from app.models.patient import PatientRecord
from app.models.referral import Referral
from app.models.triage import TriageSession
from app.schemas.asha import AshaRecordCreate, TriageSessionSyncCreate
from app.services import dashboard_service, sync_service
from app.services.rag import retriever
from app.services.rag import ingest as rag_ingest


# ---------------------------------------------------------------------------
# 5B — Last-Write-Wins
# ---------------------------------------------------------------------------


async def _upsert(worker_id: int, local_id: str, created_at: datetime):
    async with AsyncSessionLocal() as db:
        rec, created = await sync_service.upsert_asha_record(
            db, worker_id,
            AshaRecordCreate(
                record_type="household_survey",
                structured_fields={"note": f"v-{created_at.timestamp():.0f}"},
                device_local_id=local_id,
                created_at=created_at,
            ),
        )
        await db.commit()
        return rec, created


@pytest.mark.asyncio
async def test_lww_stale_retransmission_never_clobbers():
    local = f"lww-stale-{datetime.now(timezone.utc).timestamp():.0f}"
    newer = datetime(2026, 10, 25, 12, 0, tzinfo=timezone.utc)
    stale = newer - timedelta(hours=3)

    await _upsert(1, local, newer)
    # A flaky-network retransmission of an OLDER edit must be ignored.
    rec, created = await _upsert(1, local, stale)
    assert created is False
    # SQLite hands back naive datetimes — normalize before comparing.
    assert sync_service._as_aware(rec.created_at) == newer, "stale retransmission overwrote the newer row"
    assert rec.structured_fields["note"] == f"v-{newer.timestamp():.0f}"


@pytest.mark.asyncio
async def test_lww_newer_device_edit_wins():
    local = f"lww-newer-{datetime.now(timezone.utc).timestamp():.0f}"
    old = datetime(2026, 10, 25, 9, 0, tzinfo=timezone.utc)
    new = old + timedelta(hours=2)

    await _upsert(1, local, old)
    rec, created = await _upsert(1, local, new)
    assert created is False
    assert rec.created_at == new, "a genuinely newer edit must replace the stored row"


@pytest.mark.asyncio
async def test_lww_naive_vs_aware_never_crashes():
    """SQLite returns naive datetimes; the comparison must be tz-normalized."""
    local = f"lww-tz-{datetime.now(timezone.utc).timestamp():.0f}"
    stored = datetime(2026, 10, 25, 10, 0, tzinfo=timezone.utc)
    await _upsert(1, local, stored)
    # Incoming naive timestamp (as JSON-parsed clients sometimes send).
    rec, _ = await _upsert(1, local, datetime(2026, 10, 25, 9, 0))  # naive → older
    assert sync_service._as_aware(rec.created_at) == stored


@pytest.mark.asyncio
async def test_lww_triage_session_stale_ignored():
    local = f"lww-ts-{datetime.now(timezone.utc).timestamp():.0f}"
    newer = datetime(2026, 10, 25, 12, 0, tzinfo=timezone.utc)
    stale = newer - timedelta(minutes=30)
    async with AsyncSessionLocal() as db:
        await sync_service.upsert_triage_session(db, TriageSessionSyncCreate(
            urgency_tier="L2", symptom_category="fever", region="",
            timestamp=newer, device_local_id=local,
        ))
        rec, _ = await sync_service.upsert_triage_session(db, TriageSessionSyncCreate(
            urgency_tier="L4", symptom_category="fever", region="",
            timestamp=stale, device_local_id=local,
        ))
        await db.commit()
    assert rec.urgency_tier == "L2", "stale triage retransmission overwrote the newer row"


# ---------------------------------------------------------------------------
# 5A — district scoping
# ---------------------------------------------------------------------------


async def _seed_referral_in_district(district: str, status: str) -> None:
    async with AsyncSessionLocal() as db:
        fac = Facility(name=f"Fac-{district}-{status}", type="CHC",
                       pm_jay_empaneled=True, lat=22.0, lng=88.0,
                       district=district, state="WB")
        db.add(fac)
        await db.flush()
        pat = PatientRecord(demographic_hash=f"hash-{district}-{status}",
                            display_name="T", age_band="19-40", risk_flags={})
        db.add(pat)
        await db.flush()
        db.add(Referral(patient_id=pat.id, from_facility_id=fac.id,
                       to_facility_id=fac.id, urgency_tier="L2", status=status))
        await db.commit()


@pytest.mark.asyncio
async def test_dashboard_district_scoping_filters_referrals():
    d = f"ScopedDistrict-{datetime.now(timezone.utc).timestamp():.0f}"
    await _seed_referral_in_district(d, "completed")
    await _seed_referral_in_district(d, "pending")   # an OPEN referral inside d
    await _seed_referral_in_district(f"Other-{d}", "pending")  # invisible to d

    # The dashboard read path is cache-served (15-min TTL); clear it so the
    # global view reflects THIS test's rows, not an earlier suite's snapshot.
    dashboard_service._dashboard_cache.clear()

    async with AsyncSessionLocal() as db:
        scoped = await dashboard_service.district_aggregates(db, district_id=d)
    # Scoped view: 1 of 2 in-district referrals completed; the single open
    # one is the facility_load entry. The other district's rows never leak.
    assert scoped["referral_completion_rate"] == 0.5
    assert list(scoped["facility_load"].values()) == [1]
    # Global view sees at least BOTH seeded districts' open referrals
    # (robust to other suites adding rows to the shared test DB).
    async with AsyncSessionLocal() as db:
        global_view = await dashboard_service.district_aggregates(db, district_id=None)
    assert len(global_view["facility_load"]) >= 2


@pytest.mark.asyncio
async def test_dashboard_district_scopes_triage_by_region():
    d = f"RegionDistrict-{datetime.now(timezone.utc).timestamp():.0f}"
    async with AsyncSessionLocal() as db:
        db.add(TriageSession(urgency_tier="L4", symptom_category="cardiac", region=d))
        await db.commit()
        scoped = await dashboard_service.district_aggregates(db, district_id=d)
    assert scoped["triage_volume_by_tier"].get("L4") == 1
    # Unscoped sessions (region="") are excluded from the scoped view.
    assert sum(v for k, v in scoped["triage_volume_by_tier"].items() if k != "L4") == 0


# ---------------------------------------------------------------------------
# 5E — grounding-bypass closed (reasoning path; the vision path shares it)
# ---------------------------------------------------------------------------


async def _seed_clinical_chunk(name: str = "grounding_bypass_fixture.pdf") -> None:
    text = "FEVER\nfever cough fast breathing high temperature danger signs. " * 60
    async with AsyncSessionLocal() as db:
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / name
            p.write_bytes(text.encode("utf-8"))
            with mock.patch.object(rag_ingest, "_extract_pdf_text", return_value=text):
                await rag_ingest.ingest_file(db, p, corpus="clinical")
            await db.commit()
    retriever.invalidate_corpus_index()


@pytest.mark.asyncio
async def test_uncited_output_with_chunks_is_stage_failure(monkeypatch):
    await _seed_clinical_chunk(f"bypass-{datetime.now(timezone.utc).timestamp():.0f}.pdf")

    # Corpus is retrievable for this non-red-flag query.
    async with AsyncSessionLocal() as db:
        hits = await retriever.search_corpus(db, "fever cough fast breathing")
    assert hits, "fixture not retrievable — test premise broken"

    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    monkeypatch.setattr(settings, "NVIDIA_API_KEY", "")

    # The model returns a well-formed answer that cites NOTHING.
    class _M:
        async def acompletion(self, **kw):
            class _R:
                choices = [type("C", (), {"message": type("Msg", (), {"content": json.dumps({
                    "severity_signal": "non_serious", "finding_category": "febrile illness",
                    "confidence": 80, "reason": "fever with cough", "grounding_reference": None,
                })()})()})]
            return _R()

    from app.services import reasoning_engine

    with mock.patch.dict(sys.modules, {"litellm": _M()}):
        res = await reasoning_engine.analyze_text("fever and cough fast breathing")
    assert res.severity_signal == "uncertain"
    assert res.model_version == "cascade.failed", (
        "5E regression: an uncited answer was accepted while chunks were available"
    )
    assert res.grounding_verified is False
