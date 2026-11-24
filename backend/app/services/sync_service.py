"""Sync service — batch ingestion from intermittently-online mobile devices.

Designed for offline-first mobile apps that, when connectivity returns,
upsert an array of AshaRecords + TriageSessions in one call. Dedup keys
are `(device_local_id, worker_id)` and `(device_local_id)` respectively,
so retransmissions during flaky network are idempotent.

Last-Write-Wins (phase-5 item 5B): a retransmitted STALE record — one whose
device timestamp is older than what's already stored — never clobbers the
newer row. Comparison is timezone-normalized because SQLite hands back
naive datetimes and a naive-vs-aware comparison raises.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asha import AshaRecord
from app.models.triage import TriageSession
from app.schemas.asha import AshaRecordCreate, TriageSessionSyncCreate

logger = logging.getLogger("swasthyasetu")


def _as_aware(dt: datetime) -> datetime:
    """SQLite drops tzinfo on the way out — treat naive rows as UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


async def upsert_asha_record(
    db: AsyncSession,
    worker_id: int,
    payload: AshaRecordCreate,
) -> tuple[AshaRecord, bool]:
    """Insert or update by (worker_id, device_local_id). Returns (record, created).

    An update only applies when the incoming device timestamp is NEWER than
    the stored one (Last-Write-Wins); stale retransmissions are ignored.
    """
    device_local_id = payload.device_local_id
    existing_id = await db.execute(
        select(AshaRecord.id)
        .where(AshaRecord.worker_id == worker_id)
        .where(AshaRecord.device_local_id == device_local_id)
        .limit(1)
    )
    existing_pk = existing_id.scalar_one_or_none()

    device_created_at = payload.created_at or datetime.now(timezone.utc)
    now_ts = datetime.now(timezone.utc)

    if existing_pk is not None:
        existing = await db.get(AshaRecord, existing_pk)
        # Last-Write-Wins: incoming <= existing means this is a stale or
        # duplicate retransmission — keep the newer stored row.
        if (
            existing.created_at is not None
            and _as_aware(device_created_at) <= _as_aware(existing.created_at)
        ):
            logger.info(
                "[Sync] Ignored stale update for device_local_id=%s (incoming %s <= existing %s)",
                device_local_id, device_created_at, existing.created_at,
            )
            return existing, False
        existing.record_type = payload.record_type
        existing.structured_fields = payload.structured_fields
        existing.created_at = device_created_at
        existing.synced_at = now_ts
        await db.flush()
        return existing, False

    record = AshaRecord(
        worker_id=worker_id,
        record_type=payload.record_type,
        structured_fields=payload.structured_fields,
        created_at=device_created_at,
        synced_at=now_ts,
        device_local_id=device_local_id,
    )
    db.add(record)
    await db.flush()
    return record, True


# Alias matching verification script contract
upsert_record = upsert_asha_record


async def upsert_triage_session(
    db: AsyncSession,
    payload: TriageSessionSyncCreate,
) -> tuple[TriageSession, bool]:
    """Idempotent insert by device_local_id, Last-Write-Wins on timestamp."""
    existing_id = await db.execute(
        select(TriageSession.id)
        .where(TriageSession.device_local_id == payload.device_local_id)
        .limit(1)
    )
    existing_pk = existing_id.scalar_one_or_none()

    if existing_pk is not None:
        existing = await db.get(TriageSession, existing_pk)
        # Same LWW guard as AshaRecord — the same overwrite hazard lived here.
        if (
            existing.timestamp is not None
            and _as_aware(payload.timestamp) <= _as_aware(existing.timestamp)
        ):
            logger.info(
                "[Sync] Ignored stale triage session for device_local_id=%s",
                payload.device_local_id,
            )
            return existing, False
        existing.urgency_tier = payload.urgency_tier
        existing.symptom_category = payload.symptom_category
        existing.region = payload.region
        existing.timestamp = payload.timestamp
        await db.flush()
        return existing, False

    session = TriageSession(
        urgency_tier=payload.urgency_tier,
        symptom_category=payload.symptom_category,
        region=payload.region,
        timestamp=payload.timestamp,
        device_local_id=payload.device_local_id,
    )
    db.add(session)
    await db.flush()
    return session, True


async def ingest_batch(
    db: AsyncSession,
    worker_id: int,
    ash_records: list[AshaRecordCreate],
    triage_sessions: list[TriageSessionSyncCreate],
) -> dict:
    upserted_records = 0
    duplicates_records = 0
    received_records = len(ash_records)

    for item in ash_records:
        _, created = await upsert_asha_record(db, worker_id, item)
        if created:
            upserted_records += 1
        else:
            duplicates_records += 1

    upserted_triage = 0
    duplicates_triage = 0
    received_triage = len(triage_sessions)

    for item in triage_sessions:
        _, created = await upsert_triage_session(db, item)
        if created:
            upserted_triage += 1
        else:
            duplicates_triage += 1

    return {
        "received_records": received_records,
        "upserted_records": upserted_records,
        "received_triage": received_triage,
        "upserted_triage": upserted_triage,
        "duplicates_ignored": duplicates_records + duplicates_triage,
    }
