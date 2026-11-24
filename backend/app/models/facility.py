"""Facility model (Sub-Centres, PHCs, CHCs, PM-JAY hospitals, PMBJP pharmacies)."""
from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.pricing import Pricing

# JSON storage with the Postgres-native variant for production (mirrors capacity.py).
JSON_TYPE = JSON().with_variant(JSONB(), "postgresql")


class FacilityType(str, PyEnum):
    SC = "SC"  # Sub-Centre
    PHC = "PHC"  # Primary Health Centre
    CHC = "CHC"  # Community Health Centre
    PM_JAY_HOSPITAL = "PM-JAY_Hospital"
    PMBJP_PHARMACY = "PMBJP_Pharmacy"


class Facility(Base):
    __tablename__ = "facilities"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    pm_jay_empaneled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    district: Mapped[str] = mapped_column(String(128), nullable=False)
    state: Mapped[str] = mapped_column(String(128), nullable=False)
    # When the facility data was last verified (null = no verified date on record).
    last_verified_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # doc 25 §4 — supplementary fields from governed sources. Static details
    # (phone, services_offered) carry no staleness label; time-sensitive
    # `operating_hours` is always paired with its snapshot timestamp (02_PRD
    # FR-12 "as of" discipline). Omitted (None) when unverifiable.
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    services_offered: Mapped[dict | None] = mapped_column(JSON_TYPE, nullable=True)
    operating_hours: Mapped[dict | None] = mapped_column(JSON_TYPE, nullable=True)
    hours_snapshot_taken_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    pricing: Mapped[list["Pricing"]] = relationship(
        "Pricing", back_populates="facility", cascade="all, delete-orphan"
    )
