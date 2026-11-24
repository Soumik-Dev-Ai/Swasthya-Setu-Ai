"""User / Auth schemas."""
from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str
    # Present on login/refresh responses; existing clients may ignore it.
    refresh_token: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1, max_length=4096)


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    role: str


# ---------- ASHA worker discovery / registration ----------


class AshaWorkerPublicOut(BaseModel):
    """Public-facing ASHA worker card. Phone is masked for privacy."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    village_ward: str
    block_tehsil: str
    district: str
    state: str
    specialities: list[str]  # split from comma-separated string
    phone_masked: str  # "XXXXXX7890" — only last 4 digits visible
    latitude: float | None = None
    longitude: float | None = None


class AshaRegistrationRequest(BaseModel):
    # Account credentials
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)

    # Profile details (stored in asha_worker_profiles)
    full_name: str = Field(..., min_length=2, max_length=128)
    date_of_birth: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")  # YYYY-MM-DD
    phone: str = Field(..., min_length=10, max_length=15)
    aadhaar_last4: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")
    village_ward: str = Field(..., max_length=128)
    block_tehsil: str = Field("", max_length=128)
    district: str = Field(..., max_length=128)
    state: str = Field(..., max_length=64)
    nearest_facility_id: int | None = None
    specialities: list[str] = Field(default_factory=list)  # ["HBNC", "IMNCI", "NSSK"]


class AshaRegistrationResponse(BaseModel):
    status: str  # "submitted"
    message: str
    username: str
