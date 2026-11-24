"""Doc 25 §2/§3 tests: scheme enrollment fields + facility directions URL."""
from __future__ import annotations

import pytest

from app.services import v2_data as D
from app.services import v2_engine as E


def test_every_scheme_has_enrollment_fields():
    valid_methods = {"self_service_portal", "facility_based", "csc_based", "unknown"}
    for s in D.SCHEMES:
        assert "enrollment_method" in s, s["id"]
        assert s["enrollment_method"] in valid_methods, s["id"]
        assert "registration_portal_url" in s, s["id"]
        # Honest rule: no enrollment_method that isn't a self-service portal
        # carries a portal URL (a misleading "Apply" link is health-harm).
        if s["enrollment_method"] != "self_service_portal":
            assert s["registration_portal_url"] is None, s["id"]


def test_pmjay_is_facility_csc_based_not_portal():
    pmjay = next(s for s in D.SCHEMES if s["id"] == "pmjay")
    assert pmjay["enrollment_method"] == "csc_based"
    assert pmjay["registration_portal_url"] is None


@pytest.mark.asyncio
async def test_scheme_public_exposes_enrollment():
    profile = {"state": "RJ", "income": 0, "category": "cat.sc",
               "work": "work.daily", "need": "need.general"}
    results = await E.match_schemes(profile)
    schemes = {r["scheme"]["id"]: r["scheme"] for r in results}
    assert "enrollment_method" in schemes["pmjay"]
    assert "registration_portal_url" in schemes["pmjay"]
    # chiranjeevi returns for RJ state only when matched; assert shape on any matched scheme
    for sid, sch in schemes.items():
        assert sch["enrollment_method"] in {"self_service_portal", "facility_based", "csc_based", "unknown"}


@pytest.mark.asyncio
async def test_facility_search_returns_directions_url():
    rows = await E.search_facilities("delhi", {}, "", "near")
    assert rows, "expected delhi facilities"
    for r in rows:
        lat, lon = r["hospital"]["lat"], r["hospital"]["lon"]
        assert r["directions_url"] == f"https://www.google.com/maps/dir/?api=1&destination={lat},{lon}"