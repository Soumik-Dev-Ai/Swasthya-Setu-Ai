"""V3 care-continuity router: patients, referrals, follow-ups, capacity
(FR-9, FR-10, FR-11, FR-12).

Mounted under /api/v3. Auth per docs/03 §11: ASHA and ADMIN roles.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin, require_asha_or_admin
from app.db import get_db
from app.models.capacity import FacilityCapacitySnapshot
from app.models.user import Role, User
from app.schemas.care import (
    CapacityCreate,
    CapacityOut,
    FollowUpOut,
    FollowUpRunOut,
    PatientCreate,
    PatientOut,
    PatientTimelineOut,
    ReferralCreate,
    ReferralOut,
    ReferralStatusPatch,
)
from app.services import care_service, followup_service

router = APIRouter()


@router.get("/patients", response_model=list[PatientOut])
async def list_patients(
    current: Annotated[User, Depends(require_asha_or_admin)],
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.patient import PatientRecord
    records = (await db.execute(select(PatientRecord).order_by(PatientRecord.created_at.desc()))).scalars().all()
    return records


@router.post("/patients", response_model=PatientOut, status_code=200)
async def create_patient(
    payload: PatientCreate,
    current: Annotated[User, Depends(require_asha_or_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Idempotent create — an existing demographic_hash returns the
    existing record (offline retransmission is safe)."""
    return await care_service.create_patient(
        db,
        demographic_hash=payload.demographic_hash,
        display_name=payload.display_name,
        age_band=payload.age_band,
        risk_flags=payload.risk_flags,
    )


@router.get("/patients/{patient_id}/timeline", response_model=PatientTimelineOut)
async def patient_timeline(
    patient_id: str,
    current: Annotated[User, Depends(require_asha_or_admin)],
    db: AsyncSession = Depends(get_db),
):
    patient, events = await care_service.patient_timeline(db, patient_id)
    return PatientTimelineOut(patient=patient, events=events)


@router.post("/referrals", response_model=ReferralOut, status_code=200)
async def create_referral(
    payload: ReferralCreate,
    current: Annotated[User, Depends(require_asha_or_admin)],
    db: AsyncSession = Depends(get_db),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
):
    """Create a referral; also appends a `referral_created` event to the
    patient's timeline. Retransmitted requests carrying the same
    Idempotency-Key return the original referral (never a duplicate)."""
    return await care_service.create_referral(
        db,
        patient_id=payload.patient_id,
        from_facility_id=payload.from_facility_id,
        to_facility_id=payload.to_facility_id,
        urgency_tier=payload.urgency_tier,
        created_by=current.id,
        client_created_at=payload.client_created_at,
        idempotency_key=idempotency_key,
    )


@router.patch("/referrals/{referral_id}", response_model=ReferralOut)
async def update_referral(
    referral_id: str,
    payload: ReferralStatusPatch,
    current: Annotated[User, Depends(require_asha_or_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Advance a referral's status; writes a `referral_status_change`
    event onto the patient timeline. Owner ASHA or ADMIN only."""
    return await care_service.update_referral_status(
        db,
        referral_id=referral_id,
        new_status=payload.status,
        acting_user_id=current.id,
        is_admin=(current.role == Role.ADMIN),
    )


# --- Follow-up worklist (FR-11) ---------------------------------------------


@router.get("/followups", response_model=list[FollowUpOut])
async def list_followups(
    current: Annotated[User, Depends(require_asha_or_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Open worklist, most-overdue first (doc 05 §3.6)."""
    return await followup_service.list_open(db)


@router.post("/followups/run", response_model=FollowUpRunOut)
async def run_followup_scheduler(
    current: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    """ADMIN: run the follow-up scheduler (idempotent). Returns rows created."""
    created = await followup_service.run_scheduler(db)
    return FollowUpRunOut(created=created)


@router.patch("/followups/{worklist_id}", response_model=FollowUpOut)
async def complete_followup(
    worklist_id: str,
    current: Annotated[User, Depends(require_asha_or_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Mark a follow-up as visited — resolves the entry and appends a
    `follow_up_visited` event to the patient timeline."""
    return await followup_service.complete(db, worklist_id, current.id)


# --- Facility capacity snapshot (FR-12) -------------------------------------


@router.post("/facilities/capacity", response_model=CapacityOut)
async def create_capacity_snapshot(
    payload: CapacityCreate,
    current: Annotated[User, Depends(require_asha_or_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Record a capacity snapshot. `snapshot_taken_at` is always server-set —
    the UI must show it (never imply live data)."""
    from datetime import datetime, timezone

    snap = FacilityCapacitySnapshot(
        facility_id=payload.facility_id,
        diagnostic_capacity=payload.diagnostic_capacity,
        medicine_stock=payload.medicine_stock,
        snapshot_taken_at=datetime.now(timezone.utc),
        source=payload.source,
    )
    db.add(snap)
    await db.flush()
    return snap


@router.get("/facilities/capacity", response_model=list[CapacityOut])
async def read_capacity_snapshots(
    current: Annotated[User, Depends(require_asha_or_admin)],
    db: AsyncSession = Depends(get_db),
    facility_id: int | None = None,
):
    """Latest snapshot per facility (or all if no filter), newest first."""
    from sqlalchemy import select

    stmt = select(FacilityCapacitySnapshot).order_by(
        FacilityCapacitySnapshot.snapshot_taken_at.desc()
    )
    if facility_id is not None:
        stmt = stmt.where(FacilityCapacitySnapshot.facility_id == facility_id)
    rows = (await db.execute(stmt)).scalars().all()
    # keep only the latest snapshot per facility
    seen: set[int] = set()
    latest = []
    for snap in rows:
        if snap.facility_id in seen:
            continue
        seen.add(snap.facility_id)
        latest.append(snap)
    return latest
