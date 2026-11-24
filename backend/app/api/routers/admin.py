"""Admin router — aggregate analytics over triage and ASHA records."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.db import get_db
from app.models.asha import AshaRecord
from app.models.asha_profile import AshaWorkerProfile
from app.models.triage import TriageSession
from app.models.user import Role, User
from app.models.watched_source import WatchedSource
from app.schemas.user import UserPublic

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


@router.patch("/users/{user_id}/activate", response_model=UserPublic)
async def activate_asha_worker(
    user_id: int,
    current: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
) -> User:
    """Activate a PENDING_ASHA user → ASHA. Also sets their profile to active."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != Role.PENDING_ASHA:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User is already '{user.role}', not pending",
        )

    user.role = Role.ASHA

    profile_result = await db.execute(
        select(AshaWorkerProfile).where(AshaWorkerProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if profile:
        profile.is_active = True

    await db.commit()
    return user


@router.get("/users/pending", response_model=list[UserPublic])
async def list_pending_asha(
    current: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
) -> list[User]:
    """List all PENDING_ASHA users awaiting activation."""
    result = await db.execute(
        select(User).where(User.role == Role.PENDING_ASHA).order_by(User.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/sources/status")
async def sources_status(
    current: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Doc 26 §4 — honest visibility layer: every watched source that the
    autonomous system could not resolve on its own (needs_manual_confirmation
    or unreachable), plus a running count by status."""
    rows = (await db.execute(select(WatchedSource))).scalars().all()
    by_status = {"active": 0, "unreachable": 0, "needs_manual_confirmation": 0}
    flagged = []
    for r in rows:
        by_status[r.status] = by_status.get(r.status, 0) + 1
        if r.status in ("needs_manual_confirmation", "unreachable"):
            flagged.append(
                {
                    "id": r.id,
                    "source_url": r.source_url,
                    "source_type": r.source_type,
                    "status": r.status,
                    "last_checked_at": r.last_checked_at.isoformat() if r.last_checked_at else None,
                    "last_change_at": r.last_change_at.isoformat() if r.last_change_at else None,
                }
            )
    return {"counts": by_status, "flagged": flagged}
