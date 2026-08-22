"""Facility model (Sub-Centres, PHCs, CHCs, PM-JAY hospitals, PMBJP pharmacies)."""
from enum import Enum as PyEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.pricing import Pricing


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

    pricing: Mapped[list["Pricing"]] = relationship(
        "Pricing", back_populates="facility", cascade="all, delete-orphan"
    )
