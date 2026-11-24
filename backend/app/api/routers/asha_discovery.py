"""Public ASHA worker discovery (unauthenticated).

Lets patients/users find nearby ASHA workers to call for help. Only
admin-activated (`is_active`) profiles are returned, and phone numbers are
masked to their last 4 digits before leaving the server.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.asha_profile import AshaWorkerProfile
from app.schemas.user import AshaWorkerPublicOut

router = APIRouter()


def _mask_phone(phone: str) -> str:
    """Reveal only the last 4 digits: "9876543210" -> "XXXXXX3210"."""
    return phone[-4:].rjust(len(phone), "X")


def _to_public(p: AshaWorkerProfile) -> dict:
    return {
        "id": p.id,
        "full_name": p.full_name,
        "village_ward": p.village_ward,
        "block_tehsil": p.block_tehsil,
        "district": p.district,
        "state": p.state,
        "specialities": [s for s in (p.specialities or "").split(",") if s.strip()],
        "phone_masked": _mask_phone(p.phone),
        "latitude": p.latitude,
        "longitude": p.longitude,
    }


@router.get("/nearby", response_model=list[AshaWorkerPublicOut])
async def nearby_asha_workers(
    db: Annotated[AsyncSession, Depends(get_db)],
    district: str | None = None,
    state: str | None = None,
    limit: int = Query(default=20, le=50),
):
    """Public endpoint. Active ASHA workers, optionally filtered by district/state."""
    stmt = select(AshaWorkerProfile).where(AshaWorkerProfile.is_active.is_(True))
    if district:
        stmt = stmt.where(AshaWorkerProfile.district.ilike(district))
    if state:
        stmt = stmt.where(AshaWorkerProfile.state.ilike(state))
    stmt = stmt.order_by(AshaWorkerProfile.full_name).limit(limit)

    rows = (await db.execute(stmt)).scalars().all()
    return [_to_public(p) for p in rows]
