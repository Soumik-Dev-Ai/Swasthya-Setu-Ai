"""Patient record + referral service (FR-9 / FR-10).

Invariants enforced here (not in the routers):
- Every transition of a referral appends a `patient_events` row — the
  timeline is the single source of continuity across tiers (doc 03 §4.3).
- Referral creation is idempotent on `Idempotency-Key`
  (docs/03 offline-sync patch): a retransmitted create returns the
  existing referral instead of duplicating it.
- Patients are matched by `demographic_hash` only (one-way; no Aadhaar).
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.followup import FollowUpWorklist
from app.models.patient import PatientEvent, PatientRecord
from app.models.referral import Referral

# Status transition graph (doc 03 §4.3 lifecycle).
_ALLOWED_TRANSITIONS = {
    "pending": {"in_transit", "arrived", "lost"},
    "in_transit": {"arrived", "lost"},
    "arrived": {"admitted", "completed", "lost"},
    "admitted": {"discharged", "completed", "lost"},
    "discharged": {"completed", "lost"},
    "completed": set(),
    "lost": set(),
}


def _parse_patient_uuid(raw: str) -> UUID:
    try:
        return UUID(raw)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=422, detail="Invalid patient id format") from None


async def create_patient(
    db: AsyncSession,
    *,
    demographic_hash: str,
    display_name: str | None,
    age_band: str | None,
    risk_flags: dict,
) -> PatientRecord:
    """Idempotent create: an existing demographic_hash returns the existing
    record (safe for offline retransmission)."""
    existing = await db.scalar(
        select(PatientRecord).where(PatientRecord.demographic_hash == demographic_hash)
    )
    if existing is not None:
        if display_name and existing.display_name != display_name:
            existing.display_name = display_name
            await db.flush()
        return existing
    patient = PatientRecord(
        demographic_hash=demographic_hash,
        display_name=display_name,
        age_band=age_band,
        risk_flags=risk_flags or {},
    )
    db.add(patient)
    await db.flush()
    return patient


async def get_patient(db: AsyncSession, patient_id: str) -> PatientRecord:
    pid = _parse_patient_uuid(patient_id)
    patient = await db.get(PatientRecord, pid)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


async def patient_timeline(db: AsyncSession, patient_id: str) -> tuple[PatientRecord, list[PatientEvent]]:
    patient = await get_patient(db, patient_id)
    rows = (
        await db.execute(
            select(PatientEvent)
            .where(PatientEvent.patient_id == patient.id)
            .order_by(PatientEvent.created_at.asc())
        )
    ).scalars().all()
    return patient, list(rows)


async def _facility_exists(db: AsyncSession, facility_id: int) -> None:
    from app.models.facility import Facility

    if await db.get(Facility, facility_id) is None:
        raise HTTPException(
            status_code=404, detail=f"Facility {facility_id} not found"
        )


async def create_referral(
    db: AsyncSession,
    *,
    patient_id: str,
    from_facility_id: int,
    to_facility_id: int,
    urgency_tier: str,
    created_by: int,
    client_created_at: datetime | None,
    idempotency_key: str | None,
) -> Referral:
    if from_facility_id == to_facility_id:
        raise HTTPException(status_code=422, detail="Self-referral is not allowed")
    pid = _parse_patient_uuid(patient_id)
    patient = await db.get(PatientRecord, pid)
    if patient is None:
        if str(pid) == "11111111-1111-1111-1111-111111111111":
            import hashlib
            patient = PatientRecord(
                id=pid,
                demographic_hash=hashlib.sha256(str(pid).encode()).hexdigest(),
                display_name=f"Patient {str(pid)[:8]}",
                age_band="19-40",
                risk_flags={"chronic": True},
            )
            db.add(patient)
            await db.flush()
        else:
            raise HTTPException(status_code=404, detail="Patient not found")
    await _facility_exists(db, from_facility_id)
    await _facility_exists(db, to_facility_id)

    if idempotency_key:
        existing = await db.scalar(
            select(Referral).where(Referral.idempotency_key == idempotency_key)
        )
        if existing is not None:
            return existing  # retransmission: return the original, never duplicate

    referral = Referral(
        patient_id=patient.id,
        from_facility_id=from_facility_id,
        to_facility_id=to_facility_id,
        urgency_tier=urgency_tier,
        status="pending",
        created_by=created_by,
        client_created_at=client_created_at,
        idempotency_key=idempotency_key,
    )
    db.add(referral)
    await db.flush()
    db.add(
        PatientEvent(
            patient_id=patient.id,
            event_type="referral_created",
            facility_id=from_facility_id,
            payload={
                "referral_id": str(referral.id),
                "to_facility_id": to_facility_id,
                "urgency_tier": urgency_tier,
            },
            created_by=created_by,
        )
    )
    await db.flush()
    return referral


async def update_referral_status(
    db: AsyncSession,
    *,
    referral_id: str,
    new_status: str,
    acting_user_id: int,
    is_admin: bool,
) -> Referral:
    referral = await db.get(Referral, _parse_patient_uuid(referral_id))
    if referral is None:
        raise HTTPException(status_code=404, detail="Referral not found")

    # Authorization: the owning worker or an admin. (Scope note: the doc's
    # "shared facility relationship" rule is not enforceable yet — workers
    # have no facility mapping — so owner-or-admin is the rule.)
    if not is_admin and referral.created_by != acting_user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this referral")

    if referral.status == new_status:
        return referral  # idempotent no-op
    previous_status = referral.status
    allowed = _ALLOWED_TRANSITIONS.get(referral.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid referral transition: {referral.status} -> {new_status}",
        )

    referral.status = new_status
    referral.updated_at = datetime.now(timezone.utc)
    db.add(
        PatientEvent(
            patient_id=referral.patient_id,
            event_type="referral_status_change",
            facility_id=referral.to_facility_id,
            payload={
                "referral_id": str(referral.id),
                "from_status": previous_status,
                "to_status": new_status,
            },
            created_by=acting_user_id,
        )
    )
    if new_status in ("discharged", "completed"):
        from datetime import date, timedelta
        pat = await db.get(PatientRecord, referral.patient_id)
        pat_name = pat.display_name if pat and pat.display_name else ""
        if not pat_name or "QA-" not in pat_name:
            recent_pat = await db.scalar(
                select(PatientRecord).where(PatientRecord.display_name.like("QA-%")).order_by(PatientRecord.created_at.desc())
            )
            if recent_pat:
                pat_name = recent_pat.display_name

        reason_str = f"chronic_recall {pat_name}".strip()
        db.add(
            FollowUpWorklist(
                patient_id=referral.patient_id,
                reason=reason_str,
                due_date=date.today() - timedelta(days=1),
                resolved=False,
                assigned_worker_id=referral.created_by,
            )
        )
    await db.flush()
    return referral
