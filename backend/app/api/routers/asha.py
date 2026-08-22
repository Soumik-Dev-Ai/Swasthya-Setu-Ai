"""ASHA worker router — form upload (mock OCR) + structured records."""
import time
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_asha_or_admin
from app.db import get_db
from app.models.asha import AshaRecord
from app.models.user import User
from app.schemas.asha import AshaRecordCreate, AshaRecordOut, OcrFormResponse

router = APIRouter()


@router.post("/upload-form", response_model=OcrFormResponse)
async def upload_form(
    file: UploadFile = File(...),
    current: Annotated[User, Depends(require_asha_or_admin)] = None,
) -> OcrFormResponse:
    """Mock OCR pipeline. Reads any uploaded image and returns deterministic mock fields."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image uploads are accepted for OCR.",
        )
    _ = await file.read()  # discard bytes; real implementation would OCR them

    return OcrFormResponse(
        record_type="household_survey",
        extracted_fields={
            "patient_name": "[MOCK] Auto-detected name placeholder",
            "age_years": 34,
            "gender": "FEMALE",
            "ration_card_type": "BPL",
            "existing_scheme_ids": [1],
            "notes": "Extracted by mock OCR service.",
            "submitted_asha_id": getattr(current, "id", None),
        },
        confidence=0.82,
    )


@router.post("/records", response_model=AshaRecordOut, status_code=status.HTTP_201_CREATED)
async def create_record(
    payload: AshaRecordCreate,
    current: Annotated[User, Depends(require_asha_or_admin)],
    db: AsyncSession = Depends(get_db),
) -> AshaRecord:
    record = AshaRecord(
        worker_id=current.id,
        record_type=payload.record_type,
        structured_fields=payload.structured_fields,
        created_at=payload.created_at or datetime.now(timezone.utc),
        device_local_id=payload.device_local_id,
    )
    db.add(record)
    await db.flush()
    return record


@router.get("/records", response_model=list[AshaRecordOut])
async def list_records(
    current: Annotated[User, Depends(require_asha_or_admin)],
    db: AsyncSession = Depends(get_db),
    limit: int = 100,
) -> list[AshaRecord]:
    stmt = (
        select(AshaRecord)
        .where(AshaRecord.worker_id == current.id)
        .order_by(AshaRecord.created_at.desc())
        .limit(limit)
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())
