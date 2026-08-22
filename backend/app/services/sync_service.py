"""Sync service — batch ingestion from intermittently-online mobile devices.

Designed for offline-first mobile apps that, when connectivity returns,
upsert an array of AshaRecords + TriageSessions in one call. Dedup keys
are `(device_local_id, worker_id)` and `(device_local_id)` respectively,
so retransmissions during flaky network are idempotent.
"""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asha import AshaRecord
from app.models.triage import TriageSession
from app.schemas.asha import AshaRecordCreate, TriageSessionSyncCreate


async def upsert_asha_record(
    db: AsyncSession,
    worker_id: int,
    payload: AshaRecordCreate,
) -> tuple[AshaRecord, bool]:
    """Insert or update by (worker_id, device_local_id). Returns (record, created)."""
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


async def upsert_triage_session(
    db: AsyncSession,
    payload: TriageSessionSyncCreate,
) -> tuple[TriageSession, bool]:
    """Idempotent insert by device_local_id."""
    existing_id = await db.execute(
        select(TriageSession.id)
        .where(TriageSession.device_local_id == payload.device_local_id)
        .limit(1)
    )
    existing_pk = existing_id.scalar_one_or_none()

    if existing_pk is not None:
        existing = await db.get(TriageSession, existing_pk)
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
