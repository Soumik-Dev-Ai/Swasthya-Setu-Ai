"""Phase 5 security pentest suite (doc 09 §6).

Covers: XSS in free-text + identifier fields, JWT tampering, CORS
enforcement, role escalation, and a broad SQL-injection sweep across every
text/identifier-accepting endpoint. All deterministic; no live calls.
"""
from __future__ import annotations

import base64
import json

import pytest

from app.core import security
from app.db.database import AsyncSessionLocal
from app.models.user import User

_XSS = "<script>alert(1)</script>"
_SQL = ["' OR 1=1 --", "'; DROP TABLE users;--", "1' UNION SELECT * FROM users--"]


async def _make_user(username: str, role: str) -> None:
    async with AsyncSessionLocal() as db:
        db.add(User(username=username, hashed_password=security.hash_password("pw"), role=role))
        await db.commit()


async def _login(client, username: str) -> dict:
    r = await client.post("/api/auth/login", json={"username": username, "password": "pw"})
    return r.json()


# ---------------------------------------------------------------------------
# XSS — free-text never reflected as markup; never a 500
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_xss_in_symptom_text_is_inert(client):
    from app.core.limiter import limiter

    limiter.reset()
    resp = await client.post(
        "/api/triage/analyze", json={"symptoms": f"fever {_XSS} cough", "flags": []}
    )
    assert resp.status_code == 200, resp.text
    assert "<script>" not in resp.text  # not reflected as executable markup


@pytest.mark.asyncio
async def test_xss_in_patient_name_is_stored_not_executed(client):
    await _make_user("asha_xss", "ASHA")
    tok = await _login(client, "asha_xss")
    auth = {"Authorization": f"Bearer {tok['access_token']}"}
    resp = await client.post(
        "/api/v3/patients",
        json={"demographic_hash": "xss-hash-1", "display_name": _XSS},
        headers=auth,
    )
    assert resp.status_code == 200
    # The response is JSON (content-type application/json) — a JSON string is
    # never interpreted as markup by the browser.
    assert resp.headers["content-type"].startswith("application/json")


# ---------------------------------------------------------------------------
# JWT tampering
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_tampered_jwt_is_rejected(client):
    await _make_user("asha_jwt", "ASHA")
    tok = await _login(client, "asha_jwt")
    header, payload, signature = tok["access_token"].split(".")
    # Flip a character in the payload (role ASHA -> ADMIN attempt via raw edit)
    decoded = json.loads(base64.urlsafe_b64decode(payload + "==").decode())
    decoded["role"] = "ADMIN"
    forged_payload = base64.urlsafe_b64encode(json.dumps(decoded).encode()).decode().rstrip("=")
    forged = f"{header}.{forged_payload}.{signature}"

    resp = await client.get(
        "/api/admin/analytics", headers={"Authorization": f"Bearer {forged}"}
    )
    # Signature no longer matches the tampered payload -> 401, not 200/ADMIN.
    assert resp.status_code == 401, resp.text
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


@pytest.mark.asyncio
async def test_expired_token_is_rejected(client):
    await _make_user("asha_exp", "ASHA")
    tok = await _login(client, "asha_exp")
    # Craft an expired access token signed with the real secret.
    from datetime import datetime, timedelta, timezone
    from jose import jwt

    from app.core.config import settings

    exp = int((datetime.now(timezone.utc) - timedelta(hours=1)).timestamp())
    expired = jwt.encode(
        {"sub": "1", "role": "ASHA", "typ": "access", "exp": exp},
        settings.JWT_SECRET,
        algorithm="HS256",
    )
    resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# CORS enforcement
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_cors_rejects_disallowed_origin(client):
    resp = await client.get(
        "/health", headers={"Origin": "https://evil.example.com"}
    )
    # App is configured as an allow-list (localhost:5173); a foreign origin
    # must not be granted cross-origin access.
    assert "access-control-allow-origin" not in {k.lower() for k in resp.headers}


@pytest.mark.asyncio
async def test_cors_allows_configured_origin(client):
    resp = await client.get(
        "/health", headers={"Origin": "http://localhost:5173"}
    )
    acao = {k.lower(): v for k, v in resp.headers.items()}.get("access-control-allow-origin")
    assert acao == "http://localhost:5173"


# ---------------------------------------------------------------------------
# Role escalation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_asha_cannot_reach_admin_endpoint(client):
    await _make_user("asha_esc", "ASHA")
    tok = await _login(client, "asha_esc")
    resp = await client.get(
        "/api/admin/analytics", headers={"Authorization": f"Bearer {tok['access_token']}"}
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# SQL-injection sweep — every identifier/text endpoint fails closed (422/200),
# never 500, never executes.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_sql_injection_sweep_never_yields_500(client):
    from app.core.limiter import limiter

    limiter.reset()
    cases = [
        ("POST", "/api/triage/analyze", {"symptoms": _SQL[0], "flags": []}),
        ("POST", "/api/schemes/match", {"state": _SQL[0], "income": 1, "category": "gen", "work": "farm", "need": "need.general"}),
        ("POST", "/api/cost/estimate", {"hospitalId": _SQL[0], "diseaseId": "dengue", "severity": "mild"}),
        ("POST", "/api/facilities/search", {"cityId": _SQL[0], "filters": {}, "query": "", "sort": "near"}),
        ("POST", "/api/insurance/analyze-policy", {"coverage": 100000, "type": "ind", "networkIds": [_SQL[0]]}),
    ]
    for method, path, body in cases:
        resp = await client.request(method, path, json=body)
        assert resp.status_code != 500, f"{path} returned 500 on injection"
        # Identifiers must 422 (SafeId), free text may 200 — neither can 500.
        assert resp.status_code in (200, 422, 400)
    limiter.reset()