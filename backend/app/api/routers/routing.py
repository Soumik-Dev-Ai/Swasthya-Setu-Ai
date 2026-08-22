"""Routing router."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.schemas.routing import FacilityRecommendation, RoutingRequest, RoutingResponse
from app.services.routing_engine import build_recommendations

router = APIRouter()


@router.post("/recommend", response_model=RoutingResponse)
async def recommend(
    payload: RoutingRequest,
    db: AsyncSession = Depends(get_db),
) -> RoutingResponse:
    ranked = await build_recommendations(
        db,
        urgency_tier=payload.urgency_tier,
        location=payload.location,
        user_context=payload.user_context,
    )
    recs = [FacilityRecommendation(**r) for r in ranked]
    nearest_km = recs[0].distance_km if recs else None
    return RoutingResponse(recommendations=recs, nearest_center_km=nearest_km)
