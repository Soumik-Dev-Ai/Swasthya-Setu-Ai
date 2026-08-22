"""Quick smoke test: import everything, run seed, exercise the API via TestClient."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from app.main import app
from scripts.seed_data import seed


def main() -> None:
    # Run seed to create tables and dummy data
    asyncio.run(seed())

    client = TestClient(app)

    print("\n--- Health ---")
    r = client.get("/health")
    print(r.status_code, r.json())

    print("\n--- Login (asha) ---")
    r = client.post("/api/auth/login", json={"username": "asha1", "password": "asha123"})
    print(r.status_code, r.json())
    asha_token = r.json()["access_token"]

    print("\n--- Triage: routine ---")
    r = client.post(
        "/api/triage/analyze",
        json={"symptoms": "mild cough and low fever for 2 days", "location": {"lat": 23.25, "lng": 77.41, "district": "Bhopal", "state": "MP"}},
    )
    print(r.status_code, r.json())

    print("\n--- Triage: red-flag override (chest pain) ---")
    r = client.post(
        "/api/triage/analyze",
        json={"symptoms": "chest pain and difficulty breathing", "location": {"lat": 23.25, "lng": 77.41}},
    )
    print(r.status_code, r.json())
    assert r.json()["urgency_tier"] == "EMERGENCY", "Red-flag override failed!"
    assert r.json()["overridden_by_safety_layer"] is True

    print("\n--- Routing recommend (EMERGENCY) ---")
    r = client.post(
        "/api/routing/recommend",
        json={"urgency_tier": "EMERGENCY", "location": {"lat": 28.56, "lng": 77.21}},
    )
    print(r.status_code)
    recs = r.json()["recommendations"]
    print("  count:", len(recs))
    if recs:
        print("  nearest:", recs[0]["name"], "dist:", recs[0]["distance_km"], "oop:", recs[0]["cost"]["estimated_oop_expenditure"])

    print("\n--- ASHA records (auth) ---")
    r = client.get("/api/asha/records", headers={"Authorization": f"Bearer {asha_token}"})
    print(r.status_code, "records:", len(r.json()))

    print("\n--- Sync batch (idempotent) ---")
    batch = {
        "worker_id": 2,
        "ash_records": [
            {"record_type": "household_survey", "structured_fields": {"village": "Rampur"}, "device_local_id": "dev-1", "created_at": "2026-08-20T02:00:00Z"},
        ],
        "triage_sessions": [
            {"urgency_tier": "URGENT", "symptom_category": "respiratory", "region": "Bhopal, MP", "timestamp": "2026-08-20T02:01:00Z", "device_local_id": "tdev-1"},
        ],
    }
    r = client.post("/api/sync/batch", json=batch, headers={"Authorization": f"Bearer {asha_token}"})
    print(r.status_code, r.json())
    r2 = client.post("/api/sync/batch", json=batch, headers={"Authorization": f"Bearer {asha_token}"})
    print("resync:", r2.status_code, r2.json())
    assert r2.json()["duplicates_ignored"] >= 2, "Sync idempotency failed!"

    print("\n--- Admin analytics ---")
    r = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    admin_token = r.json()["access_token"]
    r = client.get("/api/admin/analytics", headers={"Authorization": f"Bearer {admin_token}"})
    print(r.status_code, r.json())

    print("\nALL SMOKE CHECKS PASSED")


if __name__ == "__main__":
    main()
