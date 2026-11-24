"""Pytest fixtures for backend tests.

The v2 endpoints are pure computation over the static v2_data module,
so no database setup is required for these tests.
"""
import os
import sys
import tempfile
from pathlib import Path

# Set test-friendly env vars BEFORE any app import so the engine module
# binds to an isolated SQLite file.
_TMP_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_TMP_DB.close()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TMP_DB.name}"
os.environ["JWT_SECRET"] = "test-secret"
# CI/dev pin: retrieval tests run on the deterministic, offline, dependency-
# free hash profile regardless of the production EMBEDDING_MODEL default.
os.environ["EMBEDDING_MODEL"] = "hash"
# Never make live provider calls in tests: clear every LLM key and the
# web-scrape flag. Individual tests that need a provider re-set it via
# monkeypatch on settings attributes, not through the environment.
os.environ["GEMINI_API_KEY"] = ""
os.environ["GROQ_API_KEY"] = ""
os.environ["NVIDIA_API_KEY"] = ""
os.environ["ENABLE_WEB_SCRAPE"] = "false"

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.db.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest_asyncio.fixture(autouse=True)
async def _ensure_tables():
    """Create all tables before each test (the ASGI lifespan that normally
    does this doesn't run under httpx.ASGITransport)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest_asyncio.fixture
async def client():
    """Yield an httpx AsyncClient wired to the FastAPI ASGI app."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
