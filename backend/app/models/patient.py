"""Longitudinal patient record models (FR-9).

Two tables:
- `patient_records`: one row per patient, matched by a one-way
  `demographic_hash` (phone + DOB hash) — never Aadhaar / government ID.
- `patient_events`: append-only timeline of everything that happens to
  that patient (triage, referrals, visits, follow-up flags).

Deviations from docs/03 §6.2 (logged in CHANGELOG.md):
- `created_by` / FKs to users use Integer FKs because the real
  `users.id` column is Integer, not UUID.
- `patient_events.facility_id` references `facilities.id` (the doc's
  "hospitals" table does not exist in the real schema).
"""
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON, Uuid

from app.db.database import Base

JSON_TYPE = JSON().with_variant(JSONB(), "postgresql")


class PatientRecord(Base):
    __tablename__ = "patient_records"

    id: Mapped[Any] = mapped_column(Uuid, primary_key=True, default=uuid4)
    demographic_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    age_band: Mapped[str | None] = mapped_column(String(20), nullable=True)
    risk_flags: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    events: Mapped[list["PatientEvent"]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )


class PatientEvent(Base):
    __tablename__ = "patient_events"
    __table_args__ = (Index("ix_patient_events_patient_created", "patient_id", "created_at"),)

    id: Mapped[Any] = mapped_column(Uuid, primary_key=True, default=uuid4)
    patient_id: Mapped[Any] = mapped_column(
        ForeignKey("patient_records.id", ondelete="CASCADE"), nullable=False
    )
    # triage | referral_created | referral_status_change | visit | follow_up_due
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    facility_id: Mapped[int | None] = mapped_column(
        ForeignKey("facilities.id", ondelete="SET NULL"), nullable=True
    )
    payload: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE, nullable=False, default=dict)
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    patient: Mapped[PatientRecord] = relationship(back_populates="events")
