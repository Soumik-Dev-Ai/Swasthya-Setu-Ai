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

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app  # noqa: E402


@pytest_asyncio.fixture
async def client():
    """Yield an httpx AsyncClient wired to the FastAPI ASGI app."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
