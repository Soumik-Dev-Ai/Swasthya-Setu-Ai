"""ASHA worker registration → admin activation → public discovery flow.

Deterministic and offline. Covers the three gap-closure endpoints:
- POST /api/auth/register-asha  (creates PENDING_ASHA, cannot log in)
- PATCH /api/admin/users/{id}/activate + GET /api/admin/users/pending
- GET /api/v2/asha-workers/nearby  (public, masked phone, active only)

Each test uses a unique username and district so the shared (non-truncated)
test DB keeps cases independent regardless of execution order.
"""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app.core import security
from app.db.database import AsyncSessionLocal
from app.models.user import Role, User

_BASE = {
    "password": "test123",
    "full_name": "Sunita Devi",
    "date_of_birth": "1985-01-01",
    "phone": "9876543210",
    "aadhaar_last4": "7890",
    "village_ward": "Rampur",
    "state": "Uttar Pradesh",
    "specialities": ["HBNC", "IMNCI"],
}


def _payload(username: str, district: str) -> dict:
    return {**_BASE, "username": username, "district": district}


async def _make_user(username: str, role: str) -> None:
    """Idempotent user creation (the shared test DB persists across cases)."""
    async with AsyncSessionLocal() as db:
        exists = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
        if exists is None:
            db.add(User(username=username, hashed_password=security.hash_password("pw"), role=role))
            await db.commit()


async def _admin_headers(client, username: str = "admin_gc") -> dict:
    await _make_user(username, Role.ADMIN)
    r = await client.post("/api/auth/login", json={"username": username, "password": "pw"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def _register(client, username: str, district: str):
    return await client.post(
        "/api/auth/register-asha", json=_payload(username, district)
    )


@pytest.mark.asyncio
async def test_register_asha_creates_pending_user_and_rejects_login(client):
    r = await _register(client, "sunita_pend", "LucknowPend")
    assert r.status_code == 201
    assert r.json()["status"] == "submitted"

    login = await client.post(
        "/api/auth/login", json={"username": "sunita_pend", "password": "test123"}
    )
    assert login.status_code == 403
    assert "pending approval" in login.json()["error"]["message"]


@pytest.mark.asyncio
async def test_register_asha_rejects_duplicate_username(client):
    await _register(client, "sunita_dup", "LucknowDup")
    r = await _register(client, "sunita_dup", "LucknowDup")
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"


@pytest.mark.asyncio
async def test_discovery_is_empty_before_activation(client):
    await _register(client, "sunita_disc", "LucknowDisc")
    r = await client.get("/api/v2/asha-workers/nearby", params={"district": "LucknowDisc"})
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_asha_cannot_activate_or_list_pending(client):
    await _make_user("asha_gcx", Role.ASHA)
    r = await client.post("/api/auth/login", json={"username": "asha_gcx", "password": "pw"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert (await client.get("/api/admin/users/pending", headers=h)).status_code == 403
    assert (await client.patch("/api/admin/users/1/activate", headers=h)).status_code == 403


@pytest.mark.asyncio
async def test_admin_activation_enables_login_and_discovery(client):
    h = await _admin_headers(client, "admin_act")
    await _register(client, "sunita_act", "LucknowAct")

    pending = await client.get("/api/admin/users/pending", headers=h)
    assert pending.status_code == 200
    mine = [u for u in pending.json() if u["username"] == "sunita_act"]
    assert len(mine) == 1 and mine[0]["role"] == "PENDING_ASHA"
    uid = mine[0]["id"]

    act = await client.patch(f"/api/admin/users/{uid}/activate", headers=h)
    assert act.status_code == 200
    assert act.json()["role"] == "ASHA"

    # Activation is guarded: a second call is rejected, not silent.
    again = await client.patch(f"/api/admin/users/{uid}/activate", headers=h)
    assert again.status_code == 400

    login = await client.post("/api/auth/login", json={"username": "sunita_act", "password": "test123"})
    assert login.status_code == 200

    disc = await client.get("/api/v2/asha-workers/nearby", params={"district": "LucknowAct"})
    assert disc.status_code == 200
    workers = disc.json()
    assert len(workers) == 1
    w = workers[0]
    assert w["full_name"] == "Sunita Devi"
    assert w["specialities"] == ["HBNC", "IMNCI"]
    assert w["phone_masked"] == "XXXXXX3210"
    assert "9876543210" not in str(w)


@pytest.mark.asyncio
async def test_activate_unknown_user_404(client):
    h = await _admin_headers(client, "admin_404")
    r = await client.patch("/api/admin/users/999999/activate", headers=h)
    assert r.status_code == 404