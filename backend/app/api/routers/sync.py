"""Sync router — offline-first mobile batch ingestion."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_asha_or_admin
from app.db import get_db
from app.models.user import Role, User
from app.schemas.asha import SyncBatchPayload, SyncBatchResponse
from app.services.sync_service import ingest_batch

router = APIRouter()


@router.post("/batch", response_model=SyncBatchResponse)
async def sync_batch(
    payload: SyncBatchPayload,
    current: Annotated[User, Depends(require_asha_or_admin)],
    db: AsyncSession = Depends(get_db),
) -> SyncBatchResponse:
    # Workers can only sync their own records; admins can sync on behalf of any worker.
    if current.role != Role.ADMIN and payload.worker_id != current.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot sync records for a different worker",
        )

    summary = await ingest_batch(
        db,
        worker_id=payload.worker_id,
        ash_records=payload.ash_records,
        triage_sessions=payload.triage_sessions,
    )
    return SyncBatchResponse(**summary)
