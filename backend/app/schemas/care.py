"""V3 schemas: patients, referrals, intent classification (docs/03 §7, doc 16)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.v2 import SafeId

# --- Patients (FR-9) -------------------------------------------------------


class PatientCreate(BaseModel):
    # One-way hash of phone + DOB — never Aadhaar / raw government ID.
    demographic_hash: SafeId
    display_name: str | None = Field(default=None, max_length=120)
    age_band: str | None = Field(default=None, max_length=20)
    risk_flags: dict[str, Any] = Field(default_factory=dict)


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Any  # UUID
    demographic_hash: str
    display_name: str | None
    age_band: str | None
    risk_flags: dict[str, Any]
    created_at: datetime


class PatientEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Any
    patient_id: Any
    event_type: str
    facility_id: int | None
    payload: dict[str, Any]
    created_by: int | None
    created_at: datetime


class PatientTimelineOut(BaseModel):
    patient: PatientOut
    events: list[PatientEventOut]


# --- Referrals (FR-10) ------------------------------------------------------

UrgencyTier = Literal["L1", "L2", "L3", "L4"]
ReferralStatus = Literal["pending", "in_transit", "arrived", "completed", "lost"]


class ReferralCreate(BaseModel):
    patient_id: str = Field(..., min_length=8, max_length=64)  # UUID string
    from_facility_id: int
    to_facility_id: int
    urgency_tier: UrgencyTier
    # Offline-first (docs/03 patch): client-generated creation instant.
    client_created_at: datetime | None = None


class ReferralOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Any
    patient_id: Any
    from_facility_id: int | None
    to_facility_id: int | None
    urgency_tier: str
    status: str
    idempotency_key: str | None
    client_created_at: datetime | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class ReferralStatusPatch(BaseModel):
    status: ReferralStatus


# --- Intent classifier (doc 16 Task 1) --------------------------------------

IntentLabel = Literal["symptom", "cost_scheme", "both"]
IntentMethod = Literal["deterministic", "llm_fallback", "safety_gate"]


class IntentContext(BaseModel):
    """Optional structured inputs for executing the financial pipeline when
    intent resolves to cost_scheme/both. All fields validated like their
    v2 counterparts (SafeId) — the financial path stays deterministic."""

    cityId: SafeId | None = None
    hospitalId: SafeId | None = None
    diseaseId: SafeId | None = None
    severity: Literal["mild", "moderate", "severe", "critical"] | None = None


class IntentRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    flags: list[str] = Field(default_factory=list)
    context: IntentContext | None = None


class IntentResponse(BaseModel):
    intent: IntentLabel
    confidence: float = Field(ge=0.0, le=1.0)
    method: IntentMethod
    # Safety gate runs on every input before routing; on red-flag this
    # carries the emergency verdict and overrides any routing below.
    emergency: bool = False
    safety: dict[str, Any] | None = None
    # Standardized double-JSON wrapper (doc 16 §patch): when intent is
    # "both", both pipelines' payloads ride together.
    data: dict[str, Any] = Field(default_factory=dict)


# --- Grounded text reasoning (doc 22 item 6) --------------------------------

class ReasonRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    flags: list[str] = Field(default_factory=list)


# --- Follow-up worklist (FR-11) ---------------------------------------------

class FollowUpOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Any
    patient_id: Any
    reason: str
    due_date: date
    resolved: bool


class FollowUpRunOut(BaseModel):
    created: int


# --- Facility capacity snapshot (FR-12) -------------------------------------

class CapacityCreate(BaseModel):
    facility_id: int
    diagnostic_capacity: dict[str, Any] = Field(default_factory=dict)
    medicine_stock: dict[str, Any] = Field(default_factory=dict)
    source: str | None = Field(default=None, max_length=60)


class CapacityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Any
    facility_id: int
    diagnostic_capacity: dict[str, Any]
    medicine_stock: dict[str, Any]
    snapshot_taken_at: datetime
    source: str | None


# --- District dashboard (FR-13) ---------------------------------------------

class DistrictDashboardOut(BaseModel):
    district_id: str | None
    triage_volume_by_tier: dict[str, int]
    referral_completion_rate: float
    follow_up_backlog: int
    facility_load: dict[str, int]
    generated_at: datetime
