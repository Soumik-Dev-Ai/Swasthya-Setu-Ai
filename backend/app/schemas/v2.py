"""V2 request/response Pydantic schemas."""
from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field


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
    cityId: SafeId
    filters: FacilitiesSearchFilters = Field(default_factory=FacilitiesSearchFilters)
    query: str = ""
    sort: Literal["near", "cost", "quality"] = "near"


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


class CostEstimateOut(BaseModel):
    hospital: dict[str, Any]
    total: int
    affordablePct: int | None
    monthly: int
    verified_sources: list[dict[str, Any]] = Field(default_factory=list)
    disclaimer: str = ""


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


# ---------- V3 deep integration: vision-augmented triage ----------

class VisionSignalOut(BaseModel):
    visual_symptom_category: str
    visual_urgency_signal: str
    confidence: int
    model_version: str
    source: str


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


class EmergencyHitOut(BaseModel):
    hospital: dict[str, Any]
    km: int
