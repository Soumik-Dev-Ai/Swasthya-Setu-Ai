"""High-risk follow-up engine (FR-11, doc 03 §6.2 `follow_up_worklist`).

A scheduled pass flags patients tagged maternal / child / chronic whose
most recent care event is older than the reason's window and who have no
open worklist entry yet. The worklist is a *prompt to the ASHA to reach
out* — it never gates the patient's other flows (doc 04 §4 gender/fairness
guard).

Purity note: the scheduler is deterministic and idempotent — re-running it
never double-flags a patient for the same reason.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.followup import FollowUpWorklist
from app.models.patient import PatientEvent, PatientRecord

logger = logging.getLogger("swasthyasetu")

# reason → follow-up window in days (doc 02 FR-11: maternal/child/chronic).
_REASON_WINDOWS: dict[str, int] = {
    "maternal": 28,
    "child_immunization": 30,
    "chronic_recall": 14,
}
# Order maps risk-flag keys to the follow-up reason; first present flag wins.
_FLAG_TO_REASON: tuple[tuple[str, str], ...] = (
    ("maternal", "maternal"),
    ("child", "child_immunization"),
    ("chronic", "chronic_recall"),
)


def _reason_for(risk_flags: dict) -> str | None:
    if not isinstance(risk_flags, dict):
        return None
    for flag, reason in _FLAG_TO_REASON:
        if flag in risk_flags:
            return reason
    return None


def _as_aware(dt: datetime) -> datetime:
    """SQLite drops tzinfo on the way back out — treat naive rows as UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


async def _last_event_at(db: AsyncSession, patient_id: UUID) -> datetime:
    latest = await db.scalar(
        select(func.max(PatientEvent.created_at)).where(PatientEvent.patient_id == patient_id)
    )
    if latest is None:
        patient = await db.get(PatientRecord, patient_id)
        return _as_aware(patient.created_at) if patient else datetime.now(timezone.utc)
    return _as_aware(latest)


async def run_scheduler(
    db: AsyncSession, *, now: datetime | None = None
) -> int:
    """Flag all currently-overdue high-risk patients. Returns how many new
    worklist rows were created. Idempotent per (patient, reason)."""
    now = now or datetime.now(timezone.utc)
    created = 0
    patients = (await db.execute(select(PatientRecord))).scalars().all()
    for patient in patients:
        reason = _reason_for(patient.risk_flags)
        if reason is None:
            continue
        # Skip patients already holding an open entry for this reason.
        existing = await db.scalar(
            select(FollowUpWorklist)
            .where(
                FollowUpWorklist.patient_id == patient.id,
                FollowUpWorklist.reason == reason,
                FollowUpWorklist.resolved.is_(False),
            )
        )
        if existing is not None:
            continue

        last_event = await _last_event_at(db, patient.id)
        window = _REASON_WINDOWS[reason]
        if (now - last_event) <= timedelta(days=window):
            continue  # within the follow-up window

        db.add(
            FollowUpWorklist(
                patient_id=patient.id,
                reason=reason,
                due_date=(last_event + timedelta(days=window)).date(),
                resolved=False,
                assigned_worker_id=None,
            )
        )
        created += 1
    if created:
        await db.flush()
    return created


async def list_open(db: AsyncSession) -> list[FollowUpWorklist]:
    rows = (
        await db.execute(
            select(FollowUpWorklist)
            .where(FollowUpWorklist.resolved.is_(False))
            .order_by(FollowUpWorklist.due_date.asc())
        )
    ).scalars().all()
    return list(rows)


def _parse_uuid(raw: str) -> UUID:
    try:
        return UUID(raw)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="Invalid worklist id format") from None


async def complete(db: AsyncSession, worklist_id: str, acting_user_id: int) -> FollowUpWorklist:
    entry = await db.get(FollowUpWorklist, _parse_uuid(worklist_id))
    if entry is None:
        raise HTTPException(status_code=404, detail="Follow-up entry not found")
    if entry.resolved:
        return entry  # idempotent

    entry.resolved = True
    db.add(
        PatientEvent(
            patient_id=entry.patient_id,
            event_type="follow_up_visited",
            payload={"worklist_id": str(entry.id), "reason": entry.reason},
            created_by=acting_user_id,
        )
    )
    await db.flush()
    return entry


__all__ = ["run_scheduler", "list_open", "complete"]