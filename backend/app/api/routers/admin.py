"""Admin router — aggregate analytics over triage and ASHA records."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.db import get_db
from app.models.asha import AshaRecord
from app.models.triage import TriageSession
from app.models.user import User

router = APIRouter()


@router.get("/analytics")
async def analytics(
    current: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
) -> dict:
    triage_total = await db.scalar(select(func.count(TriageSession.id)))
    triage_by_tier_rows = await db.execute(
        select(TriageSession.urgency_tier, func.count(TriageSession.id))
        .group_by(TriageSession.urgency_tier)
    )
    triage_by_tier = {tier: int(count) for tier, count in triage_by_tier_rows.all()}

    ash_records_total = await db.scalar(select(func.count(AshaRecord.id)))
    ash_by_type_rows = await db.execute(
        select(AshaRecord.record_type, func.count(AshaRecord.id))
        .group_by(AshaRecord.record_type)
    )
    ash_by_type = {rtype: int(count) for rtype, count in ash_by_type_rows.all()}

    return {
        "triage_total": int(triage_total or 0),
        "triage_by_tier": triage_by_tier,
        "asha_records_total": int(ash_records_total or 0),
        "asha_records_by_type": ash_by_type,
    }
