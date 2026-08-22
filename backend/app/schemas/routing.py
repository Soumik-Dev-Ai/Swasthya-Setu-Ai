"""Routing schemas."""
from pydantic import BaseModel, ConfigDict, Field


class RoutingRequest(BaseModel):
    urgency_tier: str = Field(..., max_length=16)
    location: dict = Field(..., description="lat/lng payload matching TriageRequest.location)")
    user_context: dict | None = None  # e.g. age, gender, income info to influence scheme match


class CostBreakdown(BaseModel):
    base_cost: float
    subsidized_cost: float
    estimated_oop_expenditure: float


class FacilityRecommendation(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    facility_id: int
    name: str
    type: str
    pm_jay_empaneled: bool
    lat: float
    lng: float
    district: str
    state: str
    distance_km: float
    recommended_scheme_ids: list[int]
    cost: CostBreakdown


class RoutingResponse(BaseModel):
    recommendations: list[FacilityRecommendation]
    nearest_center_km: float | None = None
