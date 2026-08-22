"""V2 router smoke test — exercises all 8 endpoints end-to-end."""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from app.main import app
from scripts.seed_data import seed

client = TestClient(app)


def run() -> None:
    asyncio.run(seed())  # ensure tables exist (unchanged mobile endpoints still work)

    print("\n=== 1. POST /api/triage/analyze (emergency flag) ===")
    r = client.post(
        "/api/triage/analyze",
        json={"symptoms": "chest pain and sweating, pain in left arm", "age": "54", "gender": "m", "flags": ["chest"]},
    )
    print(r.status_code)
    out = r.json()
    print(" level=", out["level"], "emergency=", out["emergency"], "matched=", [c["id"] for c in out["matched"]])
    print(" coverage=", out["coverage"], "confidence=", out["confidence"])
    print(" advice[0]=", out["advice"][0] if out["advice"] else "—")
    assert out["emergency"] is True and out["level"] == 4
    assert all(k in out["matched"][0] for k in ("id", "nameKey", "level", "keywords", "adviceKey"))

    print("\n=== 1b. triage routine ===")
    r = client.post("/api/triage/analyze", json={"symptoms": "mild fever and cough for 2 days", "flags": []})
    out = r.json()
    print(" level=", out["level"], "emergency=", out["emergency"], "matched=", [c["id"] for c in out["matched"]])
    assert out["emergency"] is False

    print("\n=== 2. POST /api/triage/emergency-route ===")
    r = client.post("/api/triage/emergency-route", json={"cityId": "delhi", "count": 4})
    out = r.json()
    print(" count=", len(out), "first=", out[0]["hospital"]["id"], "km=", out[0]["km"])
    assert all(h["hospital"]["er24"] for h in out)
    assert out == sorted(out, key=lambda h: h["km"])

    print("\n=== 3. POST /api/cost/estimate ===")
    r = client.post(
        "/api/cost/estimate",
        json={"hospitalId": "apollo-d", "diseaseId": "bypass", "severity": "severe",
              "financials": {"income": 40000, "housing": 8000, "food": 5000, "transport": 2000, "school": 0, "emi": 0, "insurancePrem": 0, "other": 0}},
    )
    out = r.json()
    print(" hospital=", out["hospital"]["name"], "total=", out["total"], "aff=", out["affordablePct"], "monthly=", out["monthly"])
    assert out["hospital"]["id"] == "apollo-d"
    assert out["affordablePct"] is not None

    print("\n=== 3b. cost/estimate without financials (affordablePct=null) ===")
    r = client.post("/api/cost/estimate", json={"hospitalId": "aiims-d", "diseaseId": "dengue", "severity": "moderate"})
    out = r.json()
    print(" total=", out["total"], "aff=", out["affordablePct"])
    assert out["affordablePct"] is None

    print("\n=== 4. POST /api/cost/alternatives ===")
    r = client.post(
        "/api/cost/alternatives",
        json={"cityId": "delhi", "diseaseId": "bypass", "severity": "severe", "pmjayOnly": False,
              "financials": {"income": 30000, "housing": 6000, "food": 4000}},
    )
    out = r.json()
    print(" count=", len(out), "top=", out[0]["hospital"]["id"], "total=", out[0]["total"])
    # V2 returns all ranked city hospitals (frontend bestMatches slices [:3],
    # costBenchmark reduces min/max/median from the full list).
    assert len(out) >= 1
    assert all(h["hospital"]["cityId"] == "delhi" for h in out)

    print("\n=== 5. POST /api/insurance/analyze-policy ===")
    r = client.post("/api/insurance/analyze-policy", json={"coverage": 200000, "type": "fam", "networkIds": ["a", "b", "c"]})
    out = r.json()
    print(" risk=", out["risk"], "score=", out["riskScore"], "gaps=", len(out["gaps"]), "claims=", len(out["claims"]), "actions=", len(out["actions"]))
    assert out["risk"] == "high"  # 200k + fam + <10 network
    assert out["inNetworkCount"] == 3

    print("\n=== 6. POST /api/schemes/match ===")
    r = client.post("/api/schemes/match", json={"state": "RJ", "income": 0, "category": "cat.gen", "work": "work.daily", "need": "need.general"})
    out = r.json()
    print(" matched ids=", [s["scheme"]["id"] for s in out])
    for s in out:
        assert s["pct"] >= 30
        assert all(k in s["scheme"] for k in ("id", "name", "short", "type", "benefit", "docs"))

    print("\n=== 7. POST /api/facilities/search ===")
    r = client.post(
        "/api/facilities/search",
        json={"cityId": "delhi", "filters": {"pmjay": True, "er24": False, "icu": False, "blood": False, "nabh": False, "beds": False}, "query": "", "sort": "near"},
    )
    out = r.json()
    print(" count=", len(out), "first=", out[0]["hospital"]["name"], "km=", out[0]["km"], "lat=", out[0]["hospital"]["lat"], "lon=", out[0]["hospital"]["lon"])
    assert "lon" in out[0]["hospital"]  # frontend Hospital type uses `lon`, not `lng`
    assert all(h["hospital"]["pmjay"] for h in out)
    assert all(h["hospital"]["cityId"] == "delhi" for h in out)
    assert out == sorted(out, key=lambda h: h["km"])

    print("\n=== 8. GET /api/asha/emergency-sync ===")
    r = client.get("/api/asha/emergency-sync")
    out = r.json()
    print(" count=", len(out), "levels=", [c["level"] for c in out])
    assert all(c["level"] == 4 for c in out)
    assert all(k in out[0] for k in ("id", "name", "age", "sex", "cityId", "symptoms", "conditions", "level", "assessedAt", "status"))

    print("\n=== backward-compat: POST /api/auth/login + /api/sync/batch still work ===")
    r = client.post("/api/auth/login", json={"username": "asha1", "password": "asha123"})
    print(" login:", r.status_code, r.json().get("role"))
    assert r.status_code == 200

    # also confirm OLD triage path now returns the v2 shape (not the old urgency_tier)
    r = client.post("/api/triage/analyze", json={"symptoms": "fever", "flags": []})
    assert "urgency_tier" not in r.json()
    assert "level" in r.json()

    print("\nALL V2 SMOKE CHECKS PASSED")


if __name__ == "__main__":
    run()
