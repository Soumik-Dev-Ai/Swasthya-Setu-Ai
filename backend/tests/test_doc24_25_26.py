"""Doc 25 §4 + Doc 26 tests: facility acquisition verification + source monitor."""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app.db.database import AsyncSessionLocal
from app.models.watched_source import WatchedSource
from app.services import source_monitor
from app.services.facility_acquisition import verify_records


# ---------------------------------------------------------------------------
# Doc 25 §4 — governed facility acquisition
# ---------------------------------------------------------------------------

GOOD = {
    "name": "R.G. Kar Medical College",
    "type": "PM-JAY_Hospital",
    "pm_jay_empaneled": True,
    "lat": 22.60,
    "lng": 88.37,
    "district": "Kolkata",
    "state": "WB",
    "phone": "+91 98300 12345",
    "services_offered": {"ipd": True, "icu": True},
    "operating_hours": {"mon-sat": "09:00-18:00"},
}


def test_verify_records_accepts_complete_record():
    verified, report = verify_records([GOOD])
    assert report.added == 1
    assert report.flagged == [] and report.rejected == []
    row = verified[0]
    assert row["phone"] == "919830012345"  # non-digits stripped
    assert row["services_offered"] == {"ipd": True, "icu": True}
    assert row["operating_hours"] == {"mon-sat": "09:00-18:00"}
    assert row["hours_snapshot_taken_at"] is not None


def test_verify_records_rejects_missing_name_and_flags_ambiguity():
    missing_name = {**GOOD, "name": ""}
    bad_coords = {**GOOD, "lat": 0, "lng": 0}
    bad_type = {**GOOD, "type": "SomeUnknownTier"}
    _, report = verify_records([missing_name, bad_coords, bad_type])
    assert report.added == 0
    assert 0 in report.rejected
    assert 1 in report.flagged  # coordinates outside India
    assert 2 in report.flagged  # unknown type


def test_verify_records_omits_unverifiable_supplementary():
    no_phone = {**GOOD, "phone": "not-a-phone"}
    no_hours = {**GOOD, "operating_hours": None}
    verified, _ = verify_records([no_phone, no_hours])
    assert verified[0]["phone"] is None  # abstain, don't guess
    assert verified[1]["operating_hours"] is None
    assert verified[1]["hours_snapshot_taken_at"] is None


# ---------------------------------------------------------------------------
# Doc 26 — change detector
# ---------------------------------------------------------------------------


async def _seed_source(url="https://example.gov/doc.pdf", source_type="rag_corpus", body="v1"):
    async with AsyncSessionLocal() as db:
        s = WatchedSource(
            source_url=url, source_type=source_type,
            last_content_hash=source_monitor.content_hash(body),
        )
        db.add(s)
        await db.commit()
        return s.id


@pytest.mark.asyncio
async def test_no_change_keeps_status_active():
    sid = await _seed_source(body="stable")
    async with AsyncSessionLocal() as db:
        s = (await db.execute(select(WatchedSource).where(WatchedSource.id == sid))).scalar_one()
        out = await source_monitor.check_one(db, s, fetcher=lambda url: "stable")
        assert out == "no_change"
        assert s.status == "active"


@pytest.mark.asyncio
async def test_change_is_detected():
    sid = await _seed_source(body="old")
    async with AsyncSessionLocal() as db:
        s = (await db.execute(select(WatchedSource).where(WatchedSource.id == sid))).scalar_one()
        out = await source_monitor.check_one(db, s, fetcher=lambda url: "new")
        assert out == "changed"
        assert s.status == "active"
        assert s.last_change_at is not None


@pytest.mark.asyncio
async def test_registry_dispatches_pipeline_on_change(monkeypatch):
    sid = await _seed_source(url="https://example.gov/dispatch.pdf", source_type="dispatch_t", body="old")
    fired = []

    async def pipeline(db, source):
        fired.append(source.id)

    # Isolate from the REAL default pipelines registered at import (phase 1
    # item 1E): this is a unit test of the dispatch mechanism only.
    monkeypatch.setattr(source_monitor, "_PIPELINES", {})
    source_monitor.register_pipeline("dispatch_t", pipeline)
    async with AsyncSessionLocal() as db:
        counts = await source_monitor.run_registry(db, fetcher=lambda url: "new")
    assert counts["dispatched"] == 1
    assert fired == [sid]


@pytest.mark.asyncio
async def test_unreachable_and_needs_confirmation_statuses():
    sid = await _seed_source(body="x")
    async with AsyncSessionLocal() as db:
        s = (await db.execute(select(WatchedSource).where(WatchedSource.id == sid))).scalar_one()
        out = await source_monitor.check_one(
            db, s, fetcher=lambda url: (_ for _ in ()).throw(RuntimeError("404"))
        )
        assert out == "unreachable"
        assert s.status == "unreachable"
        await source_monitor.mark_needs_confirmation(db, sid)
    async with AsyncSessionLocal() as db:
        s = (await db.execute(select(WatchedSource).where(WatchedSource.id == sid))).scalar_one()
        assert s.status == "needs_manual_confirmation"