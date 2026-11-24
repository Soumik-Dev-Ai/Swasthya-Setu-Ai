"""Phase 2 tests: intent classification/routing, patient records, referrals,
unified error envelope, and the public heavy-endpoint rate tier.

Deterministic and offline — no live LLM calls (no provider keys in tests).
"""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app.core import security
from app.db.database import AsyncSessionLocal
from app.models.facility import Facility
from app.models.patient import PatientEvent
from app.models.user import User

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _make_user(username: str, role: str) -> None:
    async with AsyncSessionLocal() as db:
        db.add(
            User(
                username=username,
                hashed_password=security.hash_password("pw"),
                role=role,
            )
        )
        await db.commit()


async def _login(client, username: str) -> dict:
    resp = await client.post(
        "/api/auth/login", json={"username": username, "password": "pw"}
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _seed_facilities() -> tuple[int, int]:
    async with AsyncSessionLocal() as db:
        f1 = Facility(
            name="Test SC", type="SC", pm_jay_empaneled=False,
            lat=23.0, lng=77.0, district="D", state="S",
        )
        f2 = Facility(
            name="Test CHC", type="CHC", pm_jay_empaneled=True,
            lat=23.2, lng=77.2, district="D", state="S",
        )
        db.add_all([f1, f2])
        await db.commit()
        return f1.id, f2.id


# ---------------------------------------------------------------------------
# Error envelope (audit #17): one shape for every error, every router
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_error_envelope_on_validation_failure(client):
    resp = await client.post("/api/schemes/match", json={"income": "not-an-int"})
    assert resp.status_code == 422
    body = resp.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == "VALIDATION_FAILED"
    assert isinstance(body["error"]["message"], str)


@pytest.mark.asyncio
async def test_error_envelope_on_404(client):
    resp = await client.get("/api/definitely-not-a-route")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_error_envelope_on_401(client):
    resp = await client.get("/api/v3/patients/x/timeline")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


# ---------------------------------------------------------------------------
# Intent classifier (doc 16 Task 1)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_intent_red_flag_overrides_classifier_to_symptom(client):
    """Safety gate runs first, always: a red-flag string mentioning cost
    still routes to the clinical pipeline as an emergency."""
    resp = await client.post(
        "/api/v3/intent", json={"text": "chest pain, how much will it cost?"}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["emergency"] is True
    assert body["method"] == "safety_gate"
    assert body["intent"] == "symptom"
    assert "chest pain" in body["safety"]["triggered_keywords"]
    assert body["data"]["triage_data"]["level"] == 4


@pytest.mark.asyncio
async def test_intent_pure_cost_routes_to_financial_only(client):
    resp = await client.post(
        "/api/v3/intent",
        json={"text": "What is the kitna kharcha of knee surgery under ayushman?"}
    )
    body = resp.json()
    assert body["intent"] == "cost_scheme"
    assert body["method"] == "deterministic"
    assert "financial_data" in body["data"]
    assert "triage_data" not in body["data"]
    # Without structured context the financial path says so — no invented data.
    assert body["data"]["financial_data"]["status"] == "needs_structured_input"


@pytest.mark.asyncio
async def test_intent_pure_symptom_routes_to_triage_only(client):
    resp = await client.post(
        "/api/v3/intent", json={"text": "fever and vomiting since morning"}
    )
    body = resp.json()
    assert body["intent"] == "symptom"
    assert body["data"]["triage_data"]["level"] >= 1
    assert "financial_data" not in body["data"]


@pytest.mark.asyncio
async def test_intent_mixed_runs_both_pipelines_with_double_wrapper(client):
    """Mixed intent is first-class: both pipelines execute; the response is
    the standardized, frontend-safe wrapper (triage_data + financial_data)."""
    resp = await client.post(
        "/api/v3/intent",
        json={
            "text": "I have fever and headache — what will treatment cost me?",
            "context": {"diseaseId": "dengue", "severity": "moderate"},
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["intent"] == "both"
    # clinical branch executed deterministically
    triage = body["data"]["triage_data"]
    assert triage["source"] == "deterministic_safety_layer"
    # financial branch executed deterministically (verified-official path)
    fin = body["data"]["financial_data"]
    assert fin["status"] == "ok"
    assert fin["source"] == "verified_official_data"
    assert fin["total"] > 0


@pytest.mark.asyncio
async def test_intent_inconclusive_input_never_crashes(client):
    resp = await client.post("/api/v3/intent", json={"text": "hello there"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # Conservative default: no evidence -> treat as clinical, low confidence.
    assert body["intent"] == "symptom"
    assert 0.0 < body["confidence"] < 0.5
    assert body["method"] == "deterministic"  # no provider keys in tests


# ---------------------------------------------------------------------------
# Patients + referrals (FR-9, FR-10)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_patient_referral_end_to_end(client):
    await _make_user("asha_p2", "ASHA")
    auth = await _login(client, "asha_p2")
    f_from, f_to = await _seed_facilities()

    # Create patient (idempotent demographic hash)
    dh = "hash001deadbeefcafe"
    p1 = await client.post(
        "/api/v3/patients",
        json={
            "demographic_hash": dh,
            "display_name": "Test Patient",
            "age_band": "40-50",
            "risk_flags": {"chronic": ["diabetes"]},
        },
        headers=auth,
    )
    assert p1.status_code == 200, p1.text
    patient_id = p1.json()["id"]
    assert p1.json()["demographic_hash"] == dh

    p2 = await client.post("/api/v3/patients", json={"demographic_hash": dh}, headers=auth)
    assert p2.status_code == 200 and p2.json()["id"] == patient_id

    # Anonymous and missing auth are rejected
    anon = await client.get(f"/api/v3/patients/{patient_id}/timeline")
    assert anon.status_code == 401

    # Self-referral is rejected
    bad = await client.post(
        "/api/v3/referrals",
        json={"patient_id": patient_id, "from_facility_id": f_from, "to_facility_id": f_from, "urgency_tier": "L4"},
        headers=auth,
    )
    assert bad.status_code == 422

    # Create + idempotent retransmit via Idempotency-Key
    payload = {"patient_id": patient_id, "from_facility_id": f_from, "to_facility_id": f_to, "urgency_tier": "L4"}
    r1 = await client.post("/api/v3/referrals", json=payload, headers={**auth, "Idempotency-Key": "k-001"})
    assert r1.status_code == 200, r1.text
    r2 = await client.post("/api/v3/referrals", json=payload, headers={**auth, "Idempotency-Key": "k-001"})
    assert r2.json()["id"] == r1.json()["id"] == str(r1.json()["id"])
    assert r1.json()["status"] == "pending"

    referral_id = r1.json()["id"]

    # Invalid transition rejected
    bad_patch = await client.patch(
        f"/api/v3/referrals/{referral_id}", json={"status": "completed"}, headers=auth
    )
    assert bad_patch.status_code == 422

    # Valid flow: pending -> in_transit -> arrived -> completed
    for st in ("in_transit", "arrived", "completed"):
        ok = await client.patch(f"/api/v3/referrals/{referral_id}", json={"status": st}, headers=auth)
        assert ok.status_code == 200, (st, ok.text)
        assert ok.json()["status"] == st

    # Timeline carries referral_created + each status change, in order
    timeline = await client.get(f"/api/v3/patients/{patient_id}/timeline", headers=auth)
    assert timeline.status_code == 200
    events = timeline.json()["events"]
    types = [e["event_type"] for e in events]
    assert types[0] == "referral_created"
    assert types[1:] == ["referral_status_change"] * 3


@pytest.mark.asyncio
async def test_referral_authorization_is_owner_or_admin(client):
    await _make_user("asha_owner", "ASHA")
    await _make_user("asha_other", "ASHA")
    await _make_user("admin_p2", "ADMIN")
    own = await _login(client, "asha_owner")
    other = await _login(client, "asha_other")
    admin = await _login(client, "admin_p2")
    f_from, f_to = await _seed_facilities()

    p = await client.post("/api/v3/patients", json={"demographic_hash": "dh-auth-1"}, headers=own)
    r = await client.post(
        "/api/v3/referrals",
        json={"patient_id": p.json()["id"], "from_facility_id": f_from, "to_facility_id": f_to, "urgency_tier": "L2"},
        headers=own,
    )
    rid = r.json()["id"]

    # Different ASHA worker may NOT advance it
    forbidden = await client.patch(f"/api/v3/referrals/{rid}", json={"status": "arrived"}, headers=other)
    assert forbidden.status_code == 403
    # Admin may
    ok = await client.patch(f"/api/v3/referrals/{rid}", json={"status": "arrived"}, headers=admin)
    assert ok.status_code == 200


@pytest.mark.asyncio
async def test_referral_unknown_patient_and_facility_are_404(client):
    await _make_user("asha_404", "ASHA")
    auth = await _login(client, "asha_404")
    f_from, f_to = await _seed_facilities()
    resp = await client.post(
        "/api/v3/referrals",
        json={"patient_id": "00000000-0000-0000-0000-000000000000", "from_facility_id": f_from, "to_facility_id": f_to, "urgency_tier": "L1"},
        headers=auth,
    )
    assert resp.status_code == 404
    p = await client.post("/api/v3/patients", json={"demographic_hash": "dh-404"}, headers=auth)
    resp2 = await client.post(
        "/api/v3/referrals",
        json={"patient_id": p.json()["id"], "from_facility_id": f_from, "to_facility_id": 999999, "urgency_tier": "L1"},
        headers=auth,
    )
    assert resp2.status_code == 404


# ---------------------------------------------------------------------------
# Misc regressions
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_emergency_sync_rows_are_marked_synthetic(client):
    resp = await client.get("/api/asha/emergency-sync")
    assert resp.status_code == 200
    rows = resp.json()
    assert rows and all(r.get("synthetic") is True for r in rows)
    assert all(str(r["name"]).startswith("DEMO") for r in rows)


@pytest.mark.asyncio
async def test_heavy_rate_limit_on_intent(client):
    """PUBLIC_HEAVY_RATE_LIMIT (30/min) guards the OSINT/LLM surface."""
    from app.core.limiter import limiter

    limiter.reset()
    hit_429 = False
    for _ in range(35):
        resp = await client.post("/api/v3/intent", json={"text": "fever"})
        if resp.status_code == 429:
            hit_429 = True
            body = resp.json()
            assert body["error"]["code"] == "RATE_LIMITED"
            break
    assert hit_429, "heavy rate limit never fired"
    limiter.reset()
