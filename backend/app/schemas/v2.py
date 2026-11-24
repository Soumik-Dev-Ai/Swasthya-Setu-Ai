"""V2 request/response Pydantic schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, model_validator


Severity = Literal["mild", "moderate", "severe", "critical"]
SafeId = Annotated[str, Field(pattern=r"^[A-Za-z0-9_.-]{1,64}$")]


class FinancialsIn(BaseModel):
    income: int = 0
    housing: int = 0
    food: int = 0
    transport: int = 0
    school: int = 0
    emi: int = 0
    insurancePrem: int = 0
    other: int = 0


# ---------- 1. triage/analyze

class TriageAnalyzeRequest(BaseModel):
    symptoms: str = Field(..., min_length=1, max_length=4000)
    age: str | None = None
    gender: str | None = None
    flags: list[str] = Field(default_factory=list)
    # Phase 3: opt-in grounded text reasoning. Default off — the safety gate
    # and deterministic engine always run first; this only adds a grounded
    # refinement for non-red-flag inputs when the caller requests it.
    reasoning: bool = False


# ---------- 2. triage/emergency-route

class EmergencyRouteRequest(BaseModel):
    cityId: SafeId
    count: int | None = 4


# ---------- 3. cost/estimate

class CostEstimateRequest(BaseModel):
    hospitalId: SafeId
    diseaseId: SafeId
    severity: Severity
    financials: FinancialsIn | None = None


# ---------- 4. cost/alternatives

class CostAlternativesRequest(BaseModel):
    cityId: SafeId
    diseaseId: SafeId
    severity: Severity
    financials: FinancialsIn | None = None
    pmjayOnly: bool = False


# ---------- 5. insurance/analyze-policy

class AnalyzePolicyRequest(BaseModel):
    coverage: int
    type: Literal["ind", "fam"]
    networkIds: list[SafeId] = Field(default_factory=list)


# ---------- 6. schemes/match

class SchemeMatchRequest(BaseModel):
    state: SafeId
    income: int
    category: SafeId
    work: SafeId
    need: SafeId


# ---------- 7. facilities/search

class FacilitiesSearchFilters(BaseModel):
    pmjay: bool = False
    er24: bool = False
    icu: bool = False
    blood: bool = False
    nabh: bool = False
    beds: bool = False


class FacilitiesSearchRequest(BaseModel):
    cityId: SafeId | None = None
    latitude: float | None = None
    longitude: float | None = None
    filters: FacilitiesSearchFilters = Field(default_factory=FacilitiesSearchFilters)
    query: str = ""
    sort: Literal["near", "cost", "quality"] = "near"

    @model_validator(mode="after")
    def validate_search_target(self) -> FacilitiesSearchRequest:
        if not self.cityId and self.latitude is None and not self.query:
            raise ValueError("Must provide either cityId, coordinates, or query")
        if not self.cityId:
            self.cityId = "delhi"
        return self


# ---------- Generic response models (for docs; router returns dicts too)

class TriageResultOut(BaseModel):
    level: int
    emergency: bool
    matched: list[dict[str, Any]]
    coverage: int
    confidence: int
    advice: list[str]
    flags: list[str]
    # V3 deep integration: provenance + safety-transparency fields.
    model_version: str = "v2_engine.run_triage+v1"
    source: str = "deterministic_safety_layer"
    vision_signal: VisionSignalOut | None = None
    verified_sources: list[dict[str, Any]] = Field(default_factory=list)
    disclaimer: str = ""
    safety_audit: SafetyAuditOut = Field(default_factory=lambda: SafetyAuditOut(
        vision_escalated=False, vision_downgrade_blocked=False, triggered_keywords=[]
    ))
    # Phase 3: grounded text reasoning (opt-in; never overrides the gate).
    reasoning: dict[str, Any] | None = None
    grounding_reference: str | None = None


class CostEstimateOut(BaseModel):
    hospital: dict[str, Any]
    total: int
    affordablePct: int | None
    monthly: int
    verified_sources: list[dict[str, Any]] = Field(default_factory=list)
    disclaimer: str = ""
    # Freshness label, always present: ISO date from a verified government
    # row, or "curated static dataset" when only the bundled data covers it.
    as_of: str | None = None


class GapItem(BaseModel):
    severity: Literal["critical", "warn", "info"]
    text: str


class CoverageReportOut(BaseModel):
    risk: Literal["high", "med", "low"]
    riskScore: int
    gaps: list[GapItem]
    claims: list[GapItem]
    actions: list[str]
    inNetworkCount: int
    verified_sources: list[dict[str, Any]] = Field(default_factory=list)
    disclaimer: str = ""


class SchemeMatchOut(BaseModel):
    scheme: dict[str, Any]
    pct: int


class FacilityHitOut(BaseModel):
    hospital: dict[str, Any]
    km: int
    last_verified_date: datetime | None = None
    # doc 25 §3 — static Google Maps directions link (no API key, no billing).
    directions_url: str | None = None


# ---------- V3 deep integration: advanced-search ----------

class PriceEstimateOut(BaseModel):
    source: Literal["verified_official_data", "community_estimate_unverified", "no_estimate_available"]
    amount_inr: int | None
    confidence: int
    notes: str = ""
    model_version: str = ""


class FacilityAdvancedOut(BaseModel):
    hospital: dict[str, Any]
    km: int
    price: PriceEstimateOut | None
    source: str  # "verified_official_data" | "community_estimate_unverified" | "no_estimate_available"
    last_verified_date: datetime | None = None
    # doc 25 §3 — static Google Maps directions link (no API key, no billing).
    directions_url: str | None = None


# ---------- V3 deep integration: vision-augmented triage ----------

class VisionSignalOut(BaseModel):
    visual_symptom_category: str
    visual_urgency_signal: str
    confidence: int
    model_version: str
    source: str
    # Phase 1 item 1C: the vision cascade computes these grounding fields but
    # the response model silently dropped them — the frontend could never
    # see whether a citation was verified.
    grounding_reference: str | None = None
    grounding_verified: bool = False
    reason: str = ""


class SafetyAuditOut(BaseModel):
    """Transparency payload: which safety path ran, what triggered it."""
    vision_escalated: bool
    vision_downgrade_blocked: bool
    triggered_keywords: list[str]


class EmergencyCaseOut(BaseModel):
    id: str
    name: str
    age: str
    sex: str
    cityId: SafeId
    symptoms: str
    conditions: list[str]
    level: Literal[4]
    assessedAt: int
    status: Literal["pending", "accepted"]
    # True => fixture/demo row, never a real patient record (phase-0 N2).
    synthetic: bool = True


class EmergencyHitOut(BaseModel):
    hospital: dict[str, Any]
    km: int
