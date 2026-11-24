"""Phase execution prompt 2 — hybrid data strategy (in-memory first → SQL
fallback), with real evidence per item:

- 2A: `search_facilities` falls back to the governed SQL `Facility` table for
  uncurated districts; `/meta/cities` merges those districts; curated cities
  are untouched by the fallback.
- 2B: non-curated diseases resolve their base cost from the freshest ACTIVE
  `GovernmentCost` row; BOTH cost endpoints attach a real freshness label.
- 2C: SQL schemes enrich matched in-memory schemes (portal fields) and are
  appended honestly as general-eligibility rows — no fabricated matches.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

from app.db.database import AsyncSessionLocal
from app.models.facility import Facility
from app.models.government_cost import GovernmentCost
from app.models.scheme import Scheme
from app.services import v2_data as D
from app.services import v2_engine as E

GOV_KEY = "hemodialysis-session-2026"


async def _seed_facility(**kw) -> None:
    defaults = dict(
        name="Hybrid CHC", type="CHC", pm_jay_empaneled=True,
        lat=22.59, lng=88.31, district="Howrah", state="West Bengal",
    )
    defaults.update(kw)
    async with AsyncSessionLocal() as db:
        db.add(Facility(**defaults))
        await db.commit()


# ---------------------------------------------------------------------------
# 2A — facilities fallback
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_facilities_sql_fallback_for_uncurated_district():
    await _seed_facility(name="Howrah CHC A", pm_jay_empaneled=True)
    await _seed_facility(name="Howrah PHC B", pm_jay_empaneled=False, type="PHC")

    async with AsyncSessionLocal() as db:
        rows = await E.search_facilities("howrah", {}, "", "near", db=db)

    assert rows, "expected the SQL fallback to fire for the uncurated district"
    by_name = {r["hospital"]["name"]: r for r in rows}
    a = by_name["Howrah CHC A"]
    # Synthesized from REAL columns only: id/name/lat/lon/type-derived tier,
    # PM-JAY flag, directions link, verification date.
    assert a["hospital"]["id"].startswith("sql-")
    assert a["hospital"]["tier"] == "Community Health Centre"
    assert a["hospital"]["pmjay"] is True
    assert a["directions_url"].endswith(f"destination={a['hospital']['lat']},{a['hospital']['lon']}")
    assert by_name["Howrah PHC B"]["hospital"]["tier"] == "Primary Health Centre"
    # No fabricated capability numbers on SQL rows (anti-fabrication rule).
    for r in rows:
        assert "beds" not in r["hospital"]
        assert "score" not in r["hospital"]


@pytest.mark.asyncio
async def test_facilities_pmjay_filter_applies_to_sql_rows():
    await _seed_facility(name="Howrah Filtered CHC", pm_jay_empaneled=False)
    async with AsyncSessionLocal() as db:
        rows = await E.search_facilities(
            "howrah", {"pmjay": True}, "", "near", db=db
        )
    assert rows, "at least one previously-seeded empanelled facility"
    assert all(r["hospital"]["pmjay"] for r in rows)
    assert all(r["hospital"]["name"] != "Howrah Filtered CHC" for r in rows)


@pytest.mark.asyncio
async def test_facilities_curated_city_untouched_by_fallback():
    async with AsyncSessionLocal() as db:
        rows = await E.search_facilities("delhi", {}, "", "near", db=db)
    assert rows, "curated delhi hospitals"
    assert all(not str(r["hospital"]["id"]).startswith("sql-") for r in rows)


@pytest.mark.asyncio
async def test_meta_cities_merges_sql_districts(client):
    await _seed_facility(name="Howrah Meta CHC", district="MetaMerge District")
    resp = await client.get("/api/meta/cities")
    assert resp.status_code == 200
    ids = {c["id"] for c in resp.json()}
    names = {c["name"] for c in resp.json()}
    assert "delhi" in ids, "curated cities still served"
    assert "MetaMerge District" in ids and "MetaMerge District" in names
    merged = next(c for c in resp.json() if c["id"] == "MetaMerge District")
    assert isinstance(merged["lat"], float) and isinstance(merged["lon"], float)


# ---------------------------------------------------------------------------
# 2B — GovernmentCost base-cost fallback + as_of freshness
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gov_cost_fallback_resolves_base_and_as_of(client):
    async with AsyncSessionLocal() as db:
        db.add(GovernmentCost(
            procedure_key=GOV_KEY, amount_inr=12000,
            source_document="verified-rates-2026.pdf",
            grounding_quote="Hemodialysis session rate Rs 12,000",
            effective_date=date(2026, 1, 15),
            last_verified_date=datetime(2026, 1, 15, tzinfo=timezone.utc),
            needs_manual_confirmation=False, active=True, version=1,
        ))
        await db.commit()
        # Curated diseases never use the fallback.
        assert await E.fallback_gov_cost(db, "dengue") is None
        # Non-curated + verified row → the row itself.
        row = await E.fallback_gov_cost(db, GOV_KEY)
        assert row is not None and row.amount_inr == 12000

    # The override drives the same price-index math as the curated path.
    h = D.hospital_by_id("aiims-d")
    city = D.city_by_id(h["cityId"])
    expected = round(12000 * h["priceIndex"] * city["priceIndex"])
    assert E.estimate_cost("aiims-d", GOV_KEY, "mild", base_override=12000) == expected

    # /cost/alternatives: base cost from the verified row + its own date.
    resp = await client.post(
        "/api/cost/alternatives",
        json={"cityId": "jaipur", "diseaseId": GOV_KEY, "severity": "mild"},
    )
    assert resp.status_code == 200
    results = resp.json()
    assert results, "jaipur has curated hospitals to price"
    for r in results:
        assert r["total"] > 0
        assert r["as_of"] == "2026-01-15", "row's own verified date, never null"


@pytest.mark.asyncio
async def test_cost_alternatives_curated_disease_has_honest_label(client):
    resp = await client.post(
        "/api/cost/alternatives",
        json={"cityId": "jaipur", "diseaseId": "covid", "severity": "mild"},
    )
    assert resp.status_code == 200
    for r in resp.json():
        # Curated path: a real ISO date when a verified row covers it, else
        # the honest curated-dataset label — but NEVER null/"—".
        assert r["as_of"]


# ---------------------------------------------------------------------------
# 2C — SQL scheme merge (enrichment + honest general-eligibility rows)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_scheme_merge_enriches_and_appends(client):
    async with AsyncSessionLocal() as db:
        # Enrichment: name-matched row overrides portal fields (DB = freshest
        # verified source).
        db.add(Scheme(
            name="Ayushman Bharat PM-JAY",
            coverage_rules="₹5 lakh family floater",
            eligibility_notes="SECC-listed families",
            registration_portal_url="https://beneficiary.nha.gov.in/",
            enrollment_method="self_service_portal",
        ))
        # Append: SQL-only scheme with real coverage text, no rule engine.
        db.add(Scheme(
            name="Karnataka Arogya Yojana",
            coverage_rules="₹5 lakh family cover for BPL families",
            eligibility_notes="BPL / income certificate required",
            registration_portal_url=None,
            enrollment_method="facility_based",
        ))
        await db.commit()

    resp = await client.post(
        "/api/schemes/match",
        json={"state": "RJ", "income": 0, "category": "cat.gen",
              "work": "work.daily", "need": "need.general"},
    )
    assert resp.status_code == 200
    matches = resp.json()
    by_id = {m["scheme"]["id"]: m for m in matches}

    # In-memory PM-JAY remains primary, now enriched from the DB.
    pmjay = by_id["pmjay"]
    assert pmjay["scheme"]["registration_portal_url"] == "https://beneficiary.nha.gov.in/"
    assert pmjay["scheme"]["enrollment_method"] == "self_service_portal"

    sql_only = next(
        m for m in matches if m["scheme"]["name"] == "Karnataka Arogya Yojana"
    )
    s = sql_only["scheme"]
    assert s["id"].startswith("sql-")
    assert s["benefit"] == "₹5 lakh family cover for BPL families"  # real coverage_rules
    assert s["docs"] == "BPL / income certificate required"        # real eligibility_notes
    assert s["match_basis"] == "general_eligibility"               # honest marker
    assert s["registration_portal_url"] is None
