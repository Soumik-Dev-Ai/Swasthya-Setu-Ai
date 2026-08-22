"""ASHA worker record schemas."""
from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class AshaRecordCreate(BaseModel):
    record_type: str = Field(..., max_length=64)
    structured_fields: dict[str, Any] = Field(default_factory=dict)
    device_local_id: str = Field(..., min_length=1, max_length=64)
    created_at: datetime | None = None  # when record was created on device


class AshaRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    worker_id: int
    record_type: str
    structured_fields: dict[str, Any]
    created_at: datetime
    synced_at: datetime
    device_local_id: str


class OcrFormResponse(BaseModel):
    """Mocked OCR result returned from /api/asha/upload-form."""
    record_type: str
    extracted_fields: dict[str, Any]
    confidence: float


class SyncBatchPayload(BaseModel):
    """Offline mobile batch payload of asha records and triage sessions."""
    worker_id: int
    ash_records: list[AshaRecordCreate] = Field(default_factory=list)
    triage_sessions: list["TriageSessionSyncCreate"] = Field(default_factory=list)


class TriageSessionSyncCreate(BaseModel):
    urgency_tier: str = Field(..., max_length=16)
    symptom_category: str = Field(..., max_length=64)
    region: str = ""
    timestamp: datetime
    device_local_id: str = Field(..., min_length=1, max_length=64)


class SyncBatchResponse(BaseModel):
    received_records: int
    upserted_records: int
    received_triage: int
    upserted_triage: int
    duplicates_ignored: int


from app.schemas.triage import TriageSessionOut  # noqa: E402
SyncBatchPayload.model_rebuild()

