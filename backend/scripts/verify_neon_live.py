"""E2E Verification script for Neon PostgreSQL integration.

Tests:
1. Direct connection to Neon Postgres via SQLAlchemy async engine
2. Verification of applied migrations and row counts in Neon
3. Live FastAPI endpoint execution via httpx AsyncClient:
   - GET /health
   - POST /api/auth/login (reads user from Neon, verifies password, returns JWT)
   - GET /api/v2/asha-workers/nearby (reads from Neon)
   - Write & read verification to Neon database
"""
import asyncio
import os
import sys
from pathlib import Path

# Setup paths
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import httpx
from sqlalchemy import text
from app.core.config import settings
from app.db.database import AsyncSessionLocal, engine
from app.models.triage import TriageSession
from app.main import app

async def test_neon_integration():
    print("=" * 60)
    print("STEP 1: Checking Database Configuration & Direct Connection")
    print("=" * 60)
    print(f"DATABASE_URL (masked): {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")
    assert "neon.tech" in settings.DATABASE_URL, "DATABASE_URL is not pointing to Neon!"
    
    async with AsyncSessionLocal() as session:
        result = await session.execute(text("SELECT version(), current_database(), current_user;"))
        row = result.fetchone()
        print(f"[OK] Neon Connected!")
        print(f"     PostgreSQL Version: {row[0]}")
        print(f"     Current Database:   {row[1]}")
        print(f"     Current User:       {row[2]}")

        print("\nVerifying Table Counts in Neon:")
        tables = ["users", "facilities", "schemes", "alembic_version", "document_registry"]
        for tbl in tables:
            cnt = (await session.execute(text(f"SELECT count(*) FROM {tbl}"))).scalar()
            print(f"     {tbl:20}: {cnt} rows")

    print("\n" + "=" * 60)
    print("STEP 2: Testing FastAPI App Endpoints against Neon")
    print("=" * 60)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Health check
        res = await client.get("/health")
        print(f"[1] GET /health -> Status {res.status_code}: {res.json()}")
        assert res.status_code == 200

        # 2. Auth Login using seeded admin user in Neon
        login_payload = {
            "username": settings.DEFAULT_ADMIN_USERNAME,
            "password": settings.DEFAULT_ADMIN_PASSWORD
        }
        res = await client.post("/api/auth/login", json=login_payload)
        print(f"[2] POST /api/auth/login (Admin: {settings.DEFAULT_ADMIN_USERNAME}) -> Status {res.status_code}")
        assert res.status_code == 200, f"Login failed: {res.text}"
        token_data = res.json()
        access_token = token_data["access_token"]
        print(f"     Received JWT access_token (length {len(access_token)})")
        print(f"     Role verified: {token_data['role']}")

        headers = {"Authorization": f"Bearer {access_token}"}

        # 3. Discovery / Read endpoint
        res = await client.get("/api/v2/asha-workers/nearby?limit=5")
        print(f"[3] GET /api/v2/asha-workers/nearby -> Status {res.status_code}")
        assert res.status_code == 200, f"Nearby query failed: {res.text}"
        print(f"     ASHA discovery response received successfully")

        # 4. Direct Write & Commit test to Neon using TriageSession model
        print("\n[4] Testing transactional write & read in Neon:")
        async with AsyncSessionLocal() as session:
            test_session = TriageSession(
                urgency_tier="L3",
                symptom_category="fever",
                region="Dehradun",
                device_local_id="neon_e2e_test_device"
            )
            session.add(test_session)
            await session.commit()
            await session.refresh(test_session)
            print(f"     [OK] Inserted triage_sessions record with id={test_session.id} into Neon")

            # Read back
            check_res = await session.execute(
                text("SELECT id, urgency_tier, symptom_category, region FROM triage_sessions WHERE id = :id"),
                {"id": test_session.id}
            )
            rec = check_res.fetchone()
            print(f"     [OK] Read back from Neon: id={rec[0]}, tier='{rec[1]}', category='{rec[2]}', region='{rec[3]}'")
            assert rec[1] == "L3"

            # Cleanup
            await session.delete(test_session)
            await session.commit()
            print(f"     [OK] Cleaned up test record from Neon")

    print("\n" + "=" * 60)
    print("ALL NEON E2E TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_neon_integration())
