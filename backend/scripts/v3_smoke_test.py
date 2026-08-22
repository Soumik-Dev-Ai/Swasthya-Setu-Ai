"""V3 smoke test for the new deep-integration endpoints.

Run with: python scripts/v3_smoke_test.py
"""
import asyncio
import sys

sys.path.insert(0, ".")

from app.main import app
from httpx import ASGITransport, AsyncClient


async def test() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Existing JSON path
        r = await client.post(
            "/api/triage/analyze",
            json={"symptoms": "chest pain", "flags": []},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "model_version" in data
        assert "source" in data
        assert "vision_signal" in data
        assert "safety_audit" in data
        print("[1] POST /api/triage/analyze (JSON, no image) -> 200, V3 fields present")

        # 2. Red-flag text -> emergency + triggered keywords
        r = await client.post(
            "/api/triage/analyze",
            json={"symptoms": "I have chest pain and shortness of breath", "flags": []},
        )
        data = r.json()
        assert data["emergency"] is True, f"expected emergency=True, got {data['emergency']}"
        kw = data["safety_audit"]["triggered_keywords"]
        assert any("chest" in k for k in kw) or any("breath" in k for k in kw), kw
        print(f"[2] Red-flag text -> emergency=True, triggered={kw}")

        # 3. Multipart with image field
        r = await client.post(
            "/api/triage/analyze",
            data={"symptoms": "I have a rash on my arm", "flags": "[]"},
            files={"image": ("test.jpg", b"\xff\xd8\xff\xe0\x00\x10JFIF", "image/jpeg")},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "vision_signal" in data
        print(f"[3] Multipart with image -> 200, vision_signal category={data['vision_signal'].get('visual_symptom_category')}")

        # 4. Oversized image
        big = b"\x00" * (9 * 1024 * 1024)
        r = await client.post(
            "/api/triage/analyze",
            data={"symptoms": "test", "flags": "[]"},
            files={"image": ("big.jpg", big, "image/jpeg")},
        )
        assert r.status_code == 413, f"expected 413, got {r.status_code}"
        print("[4] Oversized image -> 413")

        # 5. Bad mime
        r = await client.post(
            "/api/triage/analyze",
            data={"symptoms": "test", "flags": "[]"},
            files={"image": ("doc.pdf", b"%PDF", "application/pdf")},
        )
        assert r.status_code == 415, f"expected 415, got {r.status_code}"
        print("[5] Bad mime -> 415")

        # 6. Advanced-search no disease -> no specific procedure → no estimate
        r = await client.post(
            "/api/facilities/advanced-search",
            json={"cityId": "delhi", "filters": {}, "query": "", "sort": "near"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data) > 0
        assert "price" in data[0]
        assert data[0]["source"] == "no_estimate_available", data[0]["source"]
        print(f"[6] Advanced-search (no disease) -> source={data[0]['source']} (correct: no specific procedure selected)")

        # 7. Advanced-search WITH disease (curated pricing)
        r = await client.post(
            "/api/facilities/advanced-search?disease_id=bypass&severity=severe&include_pricing=true",
            json={"cityId": "delhi", "filters": {}, "query": "", "sort": "near"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data[0]["source"] == "verified_official_data"
        assert data[0]["price"]["source"] == "verified_official_data"
        assert data[0]["price"]["amount_inr"] is not None
        print(f"[7] Advanced-search + disease -> price={data[0]['price']['amount_inr']} INR, source={data[0]['price']['source']}")

        # 8. Existing 8 v2 endpoints still pass
        endpoints = [
            ("POST", "/api/triage/emergency-route", {"cityId": "delhi", "count": 4}),
            ("POST", "/api/cost/estimate", {"hospitalId": "apollo-d", "diseaseId": "bypass", "severity": "severe"}),
            ("POST", "/api/cost/alternatives", {"cityId": "delhi", "diseaseId": "bypass", "severity": "severe"}),
            ("POST", "/api/insurance/analyze-policy", {"coverage": 200000, "type": "fam", "networkIds": []}),
            ("POST", "/api/schemes/match", {"state": "RJ", "income": 0, "category": "cat.gen", "work": "work.daily", "need": "need.general"}),
            ("POST", "/api/facilities/search", {"cityId": "delhi", "filters": {"pmjay": True}, "query": "", "sort": "near"}),
        ]
        for method, path, body in endpoints:
            r = await client.post(path, json=body)
            assert r.status_code == 200, f"{path} -> {r.status_code} {r.text}"
        r = await client.get("/api/asha/emergency-sync")
        assert r.status_code == 200
        print("[8] All 7 existing v2 endpoints + asha/emergency-sync still 200 OK")

        print()
        print("ALL V3 SMOKE TESTS PASSED")


asyncio.run(test())
