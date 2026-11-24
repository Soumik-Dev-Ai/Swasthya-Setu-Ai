"""Facility capacity snapshot (FR-12).

Explicitly non-live data: each row is a periodic, timestamped snapshot of
diagnostic capacity and medicine stock — the UI must always show
`snapshot_taken_at` alongside the values.
"""
from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON, Uuid

from app.db.database import Base

JSON_TYPE = JSON().with_variant(JSONB(), "postgresql")


class FacilityCapacitySnapshot(Base):
    __tablename__ = "facility_capacity_snapshot"

    id: Mapped[Any] = mapped_column(Uuid, primary_key=True, default=uuid4)
    facility_id: Mapped[int] = mapped_column(
        ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    diagnostic_capacity: Mapped[dict[str, Any]] = mapped_column(
        JSON_TYPE, nullable=False, default=dict
    )
    medicine_stock: Mapped[dict[str, Any]] = mapped_column(
        JSON_TYPE, nullable=False, default=dict
    )
    snapshot_taken_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # e.g. "NHA HFR public directory, manual entry"
    source: Mapped[str | None] = mapped_column(String(60), nullable=True)
