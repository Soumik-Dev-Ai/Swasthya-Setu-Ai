"""Routing engine — nearby facility recommendation + deterministic OOPE."""
import math
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.facility import Facility, FacilityType
from app.models.pricing import Pricing
from app.services import ai_client
from app.services.triage_service import TIER_FACILITY_MAP

EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between two lat/lng points."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def facilities_for_tier(urgency_tier: str) -> tuple[str, ...]:
    return TIER_FACILITY_MAP.get(urgency_tier, ("SC", "PHC", "CHC", "PM-JAY_Hospital"))


async def build_recommendations(
    db: AsyncSession,
    urgency_tier: str,
    location: dict,
    user_context: dict | None = None,
) -> list[dict]:
    lat = float(location["lat"])
    lng = float(location["lng"])

    allowed = facilities_for_tier(urgency_tier)

    stmt = (
        select(Facility)
        .where(Facility.type.in_(allowed))
        .options(selectinload(Facility.pricing))
    )
    result = await db.execute(stmt)
    facilities: Iterable[Facility] = result.scalars().all()

    ranked: list[dict] = []
    for fac in facilities:
        distance = haversine_km(lat, lng, fac.lat, fac.lng)
        # pick a representative pricing row for OOPE — fallback to zero-cost placeholder
        pricing: Pricing | None = None
        recommended_scheme_ids: list[int] = []
        cost_obj = {
            "base_cost": 0.0,
            "subsidized_cost": 0.0,
            "estimated_oop_expenditure": 0.0,
        }

        if fac.pricing:
            # Pick the cheapest OOPE row available; prefer scheme-backed rows
            best_pricing = min(
                fac.pricing, key=lambda p: max(0.0, p.base_cost - p.subsidized_cost)
            )
            oop = max(0.0, best_pricing.base_cost - best_pricing.subsidized_cost)
            cost_obj = {
                "base_cost": float(best_pricing.base_cost),
                "subsidized_cost": float(best_pricing.subsidized_cost),
                "estimated_oop_expenditure": float(oop),
            }
            pricing = best_pricing

        if pricing is not None:
            prediction = await ai_client.predict_scheme_match(
                facility_id=fac.id,
                procedure_category=pricing.procedure_category,
                user_context=user_context,
            )
            recommended_scheme_ids = prediction.scheme_ids

        ranked.append(
            {
                "facility_id": fac.id,
                "name": fac.name,
                "type": fac.type,
                "pm_jay_empaneled": bool(fac.pm_jay_empaneled),
                "lat": float(fac.lat),
                "lng": float(fac.lng),
                "district": fac.district,
                "state": fac.state,
                "distance_km": round(distance, 2),
                "recommended_scheme_ids": recommended_scheme_ids,
                "cost": cost_obj,
            }
        )

    ranked.sort(key=lambda r: (r["distance_km"], r["cost"]["estimated_oop_expenditure"]))
    return ranked
