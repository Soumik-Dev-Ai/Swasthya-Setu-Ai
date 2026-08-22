"""Triage schemas."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class LocationIn(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    district: str | None = None
    state: str | None = None


class TriageAnalyzeRequest(BaseModel):
    symptoms: str = Field(..., min_length=1, max_length=4000)
    location: LocationIn


class TriageResult(BaseModel):
    urgency_tier: str
    symptom_category: str
    region: str
    timestamp: datetime
    overridden_by_safety_layer: bool = False


class TriageSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    urgency_tier: str
    symptom_category: str
    region: str
    timestamp: datetime
    device_local_id: str | None = None
