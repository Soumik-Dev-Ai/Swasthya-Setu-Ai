"""Phase 4 tests: follow-up engine (FR-11), district dashboard (FR-13),
capacity snapshot (FR-12), calibration harness, and anonymized triage log.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.core import security
from app.db.database import AsyncSessionLocal
from app.models.capacity import FacilityCapacitySnapshot
from app.models.facility import Facility
from app.models.followup import FollowUpWorklist
from app.models.patient import PatientEvent, PatientRecord
from app.models.referral import Referral
from app.models.triage import TriageSession
from app.services import calibration, dashboard_service, followup_service


async def _make_user(username: str, role: str) -> int:
    from app.models.user import User

    async with AsyncSessionLocal() as db:
        u = User(username=username, hashed_password=security.hash_password("pw"), role=role)
        db.add(u)
        await db.commit()
        return u.id


async def _login(client, username: str) -> dict:
    r = await client.post("/api/auth/login", json={"username": username, "password": "pw"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def _seed_facility(name="CHC Test") -> int:
    async with AsyncSessionLocal() as db:
        f = Facility(name=name, type="CHC", pm_jay_empaneled=True, lat=23, lng=77, district="D", state="S")
        db.add(f)
        await db.commit()
        return f.id


# ---------------------------------------------------------------------------
# FR-11: follow-up worklist engine
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_scheduler_flags_overdue_chronic_patient():
    async with AsyncSessionLocal() as db:
        await db.execute(FollowUpWorklist.__table__.delete())
        await db.execute(PatientRecord.__table__.delete())
        await db.commit()
        db.add(
            PatientRecord(
                demographic_hash="chronic-overdue",
                risk_flags={"chronic": ["diabetes"]},
                created_at=datetime.now(timezone.utc) - timedelta(days=20),
            )
        )
        await db.commit()

        created = await followup_service.run_scheduler(db)
        await db.commit()

        rows = (await db.execute(select(FollowUpWorklist))).scalars().all()
    assert created == 1
    assert len(rows) == 1
    assert rows[0].reason == "chronic_recall"
    assert rows[0].resolved is False


@pytest.mark.asyncio
async def test_scheduler_is_idempotent_and_respects_window():
    async with AsyncSessionLocal() as db:
        await db.execute(FollowUpWorklist.__table__.delete())
        await db.execute(PatientRecord.__table__.delete())
        await db.commit()
        db.add(PatientRecord(demographic_hash="recent", risk_flags={"maternal": True}))
        db.add(
            PatientRecord(
                demographic_hash="old-maternal",
                risk_flags={"maternal": True},
                created_at=datetime.now(timezone.utc) - timedelta(days=40),
            )
        )
        await db.commit()

        first = await followup_service.run_scheduler(db)
        await db.commit()
        second = await followup_service.run_scheduler(db)
        await db.commit()

        rows = (await db.execute(select(FollowUpWorklist))).scalars().all()
    assert first == 1  # only the 40-day-old maternal patient is overdue
    assert second == 0  # re-run flags nothing new
    assert len(rows) == 1
    assert rows[0].reason == "maternal"


@pytest.mark.asyncio
async def test_complete_resolves_and_writes_timeline_event():
    async with AsyncSessionLocal() as db:
        await db.execute(FollowUpWorklist.__table__.delete())
        await db.execute(PatientRecord.__table__.delete())
        await db.execute(PatientEvent.__table__.delete())
        await db.commit()
        p = PatientRecord(demographic_hash="chronic-x", risk_flags={"chronic": ["htn"]},
                          created_at=datetime.now(timezone.utc) - timedelta(days=20))
        db.add(p)
        await db.commit()
        await db.refresh(p)
        await followup_service.run_scheduler(db)
        await db.commit()
        entry = (await db.execute(select(FollowUpWorklist))).scalars().first()

        result = await followup_service.complete(db, str(entry.id), acting_user_id=1)
        await db.commit()

        events = (await db.execute(select(PatientEvent))).scalars().all()
    assert result.resolved is True
    assert any(e.event_type == "follow_up_visited" for e in events)


@pytest.mark.asyncio
async def test_followup_endpoints_require_auth(client):
    assert (await client.get("/api/v3/followups")).status_code == 401
    assert (await client.post("/api/v3/followups/run")).status_code == 401


# ---------------------------------------------------------------------------
# FR-13: district dashboard
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_dashboard_aggregates_and_cache(client):
    await _make_user("admin_dash", "ADMIN")
    auth = await _login(client, "admin_dash")
    f1 = await _seed_facility("PHC A")
    f2 = await _seed_facility("CHC B")

    async with AsyncSessionLocal() as db:
        await db.execute(Referral.__table__.delete())
        await db.execute(TriageSession.__table__.delete())
        await db.execute(FollowUpWorklist.__table__.delete())
        await db.commit()
        # two referrals: one completed, one in transit
        p = PatientRecord(demographic_hash="dash-p")
        db.add(p)
        await db.commit()
        await db.refresh(p)
        db.add(Referral(patient_id=p.id, from_facility_id=f1, to_facility_id=f2,
                        urgency_tier="L4", status="completed"))
        db.add(Referral(patient_id=p.id, from_facility_id=f2, to_facility_id=f1,
                        urgency_tier="L2", status="in_transit"))
        db.add(TriageSession(urgency_tier="L4", symptom_category="cardiac", region=""))
        db.add(TriageSession(urgency_tier="L2", symptom_category="fever", region=""))
        db.add(FollowUpWorklist(patient_id=p.id, reason="chronic_recall",
                                due_date=datetime.now(timezone.utc).date(), resolved=False))
        await db.commit()

    r1 = await client.get("/api/v3/dashboard/district", headers=auth)
    assert r1.status_code == 200, r1.text
    body = r1.json()
    assert body["referral_completion_rate"] == 0.5
    assert body["follow_up_backlog"] == 1
    assert body["triage_volume_by_tier"] == {"L4": 1, "L2": 1}

    # Cache: a second immediate call returns the SAME generated_at (hit).
    r2 = await client.get("/api/v3/dashboard/district", headers=auth)
    assert r2.json()["generated_at"] == body["generated_at"]
    dashboard_service._dashboard_cache.clear()  # isolation


@pytest.mark.asyncio
async def test_dashboard_is_admin_only(client):
    await _make_user("asha_dash", "ASHA")
    asha = await _login(client, "asha_dash")
    assert (await client.get("/api/v3/dashboard/district", headers=asha)).status_code == 403
    assert (await client.get("/api/v3/dashboard/district")).status_code == 401


# ---------------------------------------------------------------------------
# FR-12: facility capacity snapshot
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_capacity_snapshot_roundtrip(client):
    await _make_user("asha_cap", "ASHA")
    auth = await _login(client, "asha_cap")
    fid = await _seed_facility("PHC Cap")

    async with AsyncSessionLocal() as db:
        await db.execute(FacilityCapacitySnapshot.__table__.delete())
        await db.commit()

    create = await client.post(
        "/api/v3/facilities/capacity",
        json={"facility_id": fid, "diagnostic_capacity": {"xray": True},
              "medicine_stock": {"paracetamol": 120}, "source": "manual entry"},
        headers=auth,
    )
    assert create.status_code == 200, create.text
    assert create.json()["snapshot_taken_at"]

    read = await client.get("/api/v3/facilities/capacity", headers=auth)
    assert read.status_code == 200
    snaps = read.json()
    assert any(s["facility_id"] == fid for s in snaps)
    assert all(s.get("snapshot_taken_at") for s in snaps)  # "last updated" always present


@pytest.mark.asyncio
async def test_capacity_endpoints_require_auth(client):
    assert (await client.post("/api/v3/facilities/capacity", json={"facility_id": 1})).status_code == 401
    assert (await client.get("/api/v3/facilities/capacity")).status_code == 401


# ---------------------------------------------------------------------------
# Calibration harness
# ---------------------------------------------------------------------------


def test_calibration_buckets_and_flags_overstatement():
    preds = [
        (0.95, True), (0.93, True), (0.92, False), (0.90, True),
        (0.95, True), (0.90, False), (0.95, False),  # decile 9: ~7 rows, 4 correct
    ]
    report = calibration.bucket_calibration(preds)
    decile9 = report.deciles[9]
    assert decile9["n"] == 7
    assert decile9["reported_confidence"] >= 0.9
    # 4/7 correct = 0.57 actual; overstatement > 0.15 -> flagged
    assert any(b["decile"] == 9 for b in report.overstating_buckets)


def test_calibration_handles_empty_and_full_range():
    assert calibration.bucket_calibration([]).deciles == {}
    assert calibration.bucket_calibration([]).overstating_buckets == []
    low = calibration.bucket_calibration([(0.0, False), (1.0, True)])
    assert low.deciles[0]["decile"] == 0
    assert low.deciles[9]["decile"] == 9


# ---------------------------------------------------------------------------
# Anonymized triage logging (feeds dashboard volume)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_triage_persists_anonymized_session(client):
    from app.core.limiter import limiter

    limiter.reset()
    async with AsyncSessionLocal() as db:
        await db.execute(TriageSession.__table__.delete())
        await db.commit()

    resp = await client.post(
        "/api/triage/analyze",
        json={"symptoms": "fever and cough for three days", "flags": []},
    )
    assert resp.status_code == 200, resp.text

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(TriageSession))).scalars().all()
    assert len(rows) == 1
    assert rows[0].urgency_tier in {"L1", "L2", "L3", "L4"}
    # no raw symptom text is ever stored
    assert "fever and cough for three days" not in (rows[0].symptom_category + rows[0].region)
    limiter.reset()