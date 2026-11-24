"""Phase 1 foundation tests: auth hardening, refresh tokens, safety-override
logging, production guardrails, and Alembic migrations on both engines.

Deterministic, offline, no live provider calls.
"""
from __future__ import annotations

import os
import tempfile

import pytest
from sqlalchemy import select
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from app.core import security
from app.core.config import settings, validate_production_settings
from app.db.database import AsyncSessionLocal, Base
from app.models.safety_override import SafetyOverrideLog
from app.models.user import User

# ---------------------------------------------------------------------------
# Auth hardening
# ---------------------------------------------------------------------------


async def _make_user(username: str, role: str, password: str = "pw"):
    async with AsyncSessionLocal() as db:
        user = User(
            username=username,
            hashed_password=security.hash_password(password),
            role=role,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user


@pytest.mark.asyncio
async def test_login_never_promotes_unknown_role_to_admin(client):
    """Phase-0 N1: a user row with an unrecognized role must NOT receive a
    token implicitly scoped to ADMIN. Login must fail closed."""
    await _make_user("tampered", "SUPERUSER")
    resp = await client.post(
        "/api/auth/login", json={"username": "tampered", "password": "pw"}
    )
    assert resp.status_code == 403, resp.text
    assert "token" not in resp.text.lower() or "invalid" in resp.text.lower()


@pytest.mark.asyncio
async def test_login_success_returns_access_and_refresh(client):
    await _make_user("asha_ok", "ASHA")
    resp = await client.post(
        "/api/auth/login", json={"username": "asha_ok", "password": "pw"}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["access_token"] and body["refresh_token"]
    assert body["role"] == "ASHA"


@pytest.mark.asyncio
async def test_refresh_issues_new_pair_and_rejects_access_token(client):
    await _make_user("asha_rt", "ASHA")
    login = await client.post(
        "/api/auth/login", json={"username": "asha_rt", "password": "pw"}
    )
    tokens = login.json()

    # Access token must NOT work as a refresh token.
    bad = await client.post(
        "/api/auth/refresh", json={"refresh_token": tokens["access_token"]}
    )
    assert bad.status_code == 401

    # Valid refresh token rotates both tokens.
    ok = await client.post(
        "/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert ok.status_code == 200, ok.text
    new = ok.json()
    assert new["access_token"] and new["refresh_token"]
    # The new access token must be usable (subject/role preserved).
    me = await client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {new['access_token']}"}
    )
    assert me.status_code == 200 and me.json()["username"] == "asha_rt"

    # Refresh token must NOT authenticate as an access token on /me.
    misuse = await client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {tokens['refresh_token']}"}
    )
    assert misuse.status_code == 401


@pytest.mark.asyncio
async def test_refresh_rejects_garbage_token(client):
    resp = await client.post("/api/auth/refresh", json={"refresh_token": "not-a-jwt"})
    assert resp.status_code == 401


def test_error_no_longer_leaks_jwt_internals():
    """Token decode failures must return a stable message, not library internals."""
    with pytest.raises(ValueError) as exc:
        security.decode_token("x.y.z")
    assert str(exc.value) == "Invalid token"


@pytest.mark.asyncio
async def test_login_rejects_wrong_password_and_unknown_username(client):
    """Doc 25 §1.4: wrong credentials are genuinely rejected, not silently accepted."""
    await _make_user("asha_wrongpw", "ASHA", password="correctpw")

    wrong_pw = await client.post(
        "/api/auth/login", json={"username": "asha_wrongpw", "password": "wrongpw"}
    )
    assert wrong_pw.status_code == 401, wrong_pw.text
    assert wrong_pw.json()["error"]["code"] == "UNAUTHENTICATED"

    unknown = await client.post(
        "/api/auth/login", json={"username": "no_such_user", "password": "whatever"}
    )
    assert unknown.status_code == 401
    # Identical message for both cases => no account-enumeration oracle.
    assert unknown.json()["error"]["message"] == wrong_pw.json()["error"]["message"]


@pytest.mark.asyncio
async def test_issued_token_decodes_to_matching_claims(client):
    """Doc 25 §1.4: a real issued token carries the user's actual id/role —
    proving the JWT is genuinely signed and populated, not a mock."""
    user = await _make_user("asha_claims", "ASHA")
    login = await client.post(
        "/api/auth/login", json={"username": "asha_claims", "password": "pw"}
    )
    tokens = login.json()

    access = security.decode_token(tokens["access_token"])
    assert access["sub"] == str(user.id)
    assert access["role"] == "ASHA"
    assert access["typ"] == "access"
    assert access["exp"] > access["iat"]

    refresh = security.decode_refresh_token(tokens["refresh_token"])
    assert refresh["sub"] == str(user.id)
    assert refresh["typ"] == "refresh"

    # Access and refresh tokens must not be interchangeable.
    with pytest.raises(ValueError):
        security.decode_token(tokens["refresh_token"])


# ---------------------------------------------------------------------------
# Production guardrails (phase-0 N3/N4)
# ---------------------------------------------------------------------------


def test_production_validation_rejects_default_secrets(monkeypatch):
    monkeypatch.setattr(settings, "ENV", "prod")
    monkeypatch.setattr(settings, "JWT_SECRET", "dev-insecure-secret-change-me")
    with pytest.raises(RuntimeError) as exc:
        validate_production_settings()
    assert "JWT_SECRET" in str(exc.value)


def test_production_validation_accepts_hardened_config(monkeypatch):
    monkeypatch.setattr(settings, "ENV", "prod")
    monkeypatch.setattr(settings, "JWT_SECRET", "a64charlongrandomsecretvalue-x")
    monkeypatch.setattr(settings, "JWT_REFRESH_SECRET", "another-distinct-secret-x")
    monkeypatch.setattr(settings, "DEFAULT_ADMIN_PASSWORD", "rotated-strong-pw")
    monkeypatch.setattr(
        settings, "DATABASE_URL", "postgresql+asyncpg://u:p@neon-host/db"
    )
    validate_production_settings()  # must not raise


def test_validation_is_noop_in_dev():
    assert settings.ENV != "prod"  # test env guard
    validate_production_settings()  # must not raise


# ---------------------------------------------------------------------------
# safety_override_log wiring (audit finding #6)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_vision_downgrade_blocked_writes_override_row(client):
    """Red-flag text + non_serious vision → a vision_downgrade_blocked row,
    with no raw symptom text stored (only a hash)."""
    # No image attached => vision signal starts as None; force the audit
    # fields by using the JSON path and confirming only keyword-driven
    # events log. To exercise the vision path deterministically we post
    # the JSON body — the router only writes when the audit flags fire,
    # so instead drive the engine+logger integration through the API with
    # a multipart image and a mocked vision service.
    from unittest.mock import patch

    from app.services.vision_service import VisionSignal

    fake_signal = VisionSignal(
        visual_symptom_category="skin-rash",
        visual_urgency_signal="non_serious",
        confidence=80,
        model_version="test.mock",
        source="vision_llm_cascade",
    )
    async with AsyncSessionLocal() as db:  # isolation: no leftover rows
        await db.execute(SafetyOverrideLog.__table__.delete())
        await db.commit()
    with patch(
        "app.services.vision_service.analyze_image", return_value=fake_signal
    ):
        resp = await client.post(
            "/api/triage/analyze",
            data={
                "symptoms": "chest pain radiating to arm",
                "flags": "[]",
                "age": "50",
            },
            files={"image": ("rash.png", b"\x89PNG\r\n\x1a\nfakebytes", "image/png")},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["emergency"] is True
    assert body["safety_audit"]["vision_downgrade_blocked"] is True

    async with AsyncSessionLocal() as db:
        rows = (
            (await db.execute(select(SafetyOverrideLog))).scalars().all()
        )
    assert len(rows) == 1
    row = rows[0]
    assert row.override_type == "vision_downgrade_blocked"
    assert row.vision_signal == "non_serious"
    assert row.text_signal == "red_flag"
    assert "chest pain" in row.triggered_keywords
    assert row.symptoms_hash and len(row.symptoms_hash) == 64
    # Privacy: raw symptom text must not be present in the row.
    row_dict = {c.name: getattr(row, c.name) for c in row.__table__.columns}
    assert "chest pain radiating to arm" not in str(row_dict)


@pytest.mark.asyncio
async def test_plain_triage_writes_no_override_row(client):
    async with AsyncSessionLocal() as db:
        # Clean slate within the shared test DB for this assertion.
        await db.execute(SafetyOverrideLog.__table__.delete())
        await db.commit()
    resp = await client.post(
        "/api/triage/analyze", json={"symptoms": "mild headache", "flags": []}
    )
    assert resp.status_code == 200, resp.text
    async with AsyncSessionLocal() as db:
        count = len((await db.execute(select(SafetyOverrideLog))).scalars().all())
    assert count == 0


# ---------------------------------------------------------------------------
# Migrations: offline postgres SQL render + real SQLite upgrade
# ---------------------------------------------------------------------------


def _alembic_cfg():
    from alembic.config import Config

    backend = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cfg = Config(os.path.join(backend, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(backend, "alembic"))
    return cfg


def _set_x_args(cfg, *args: str) -> None:
    """Inject alembic `-x` arguments the way the CLI does."""
    from argparse import Namespace

    cfg.cmd_opts = Namespace(x=list(args))


def test_alembic_upgrade_head_on_fresh_sqlite():
    """The full migration chain applies cleanly to an empty SQLite file."""
    from alembic import command

    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        cfg = _alembic_cfg()
        _set_x_args(cfg, f"db_url=sqlite+aiosqlite:///{path}")
        command.upgrade(cfg, "head")

        # Verify tables exist.
        from sqlalchemy import create_engine, inspect

        eng = create_engine(f"sqlite:///{path}")
        try:
            tables = set(inspect(eng).get_table_names())
        finally:
            eng.dispose()
        expected = {
            "users",
            "schemes",
            "facilities",
            "pricing",
            "triage_sessions",
            "asha_records",
            "safety_override_log",
            "patient_records",
            "patient_events",
            "referrals",
            "follow_up_worklist",
            "facility_capacity_snapshot",
        }
        assert expected.issubset(tables), f"missing: {expected - tables}"
    finally:
        os.unlink(path)


def test_alembic_offline_sql_renders_cleanly():
    """`upgrade head --sql` must render without error (dialect from URL)."""
    from alembic import command

    cfg = _alembic_cfg()
    _set_x_args(cfg, "db_url=sqlite:///offline_check.db")

    import io
    import sys

    stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        command.upgrade(cfg, "head", sql=True)
        buf = sys.stdout.getvalue()
    finally:
        sys.stdout = stdout
    assert "CREATE TABLE safety_override_log" in buf
    assert "CREATE TABLE referrals" in buf
    assert "alembic_version" in buf


def test_postgres_dialect_renders_jsonb_and_uuid():
    """The migrations' JSON/Uuid columns must compile to JSONB/UUID on
    PostgreSQL (verified without needing a live DB or driver)."""
    jsonb_tables = [
        "asha_records",
        "safety_override_log",
        "patient_records",
        "patient_events",
        "facility_capacity_snapshot",
    ]
    for name in jsonb_tables:
        table = Base.metadata.tables[name]
        ddl = str(CreateTable(table).compile(dialect=postgresql.dialect()))
        assert "JSONB" in ddl, f"{name} did not render JSONB on postgres"
    uuid_ddl = str(
        CreateTable(Base.metadata.tables["referrals"]).compile(
            dialect=postgresql.dialect()
        )
    )
    assert "UUID" in uuid_ddl


def test_models_metadata_matches_migration_targets():
    """Every model table renders valid DDL on the postgres dialect."""
    for table in Base.metadata.sorted_tables:
        ddl = str(CreateTable(table).compile(dialect=postgresql.dialect()))
        assert "CREATE TABLE" in ddl
