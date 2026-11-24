"""Referral tracking (FR-10): a patient moving between care tiers."""
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.db.database import Base


class Referral(Base):
    __tablename__ = "referrals"

    id: Mapped[Any] = mapped_column(Uuid, primary_key=True, default=uuid4)
    patient_id: Mapped[Any] = mapped_column(
        ForeignKey("patient_records.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_facility_id: Mapped[int | None] = mapped_column(
        ForeignKey("facilities.id", ondelete="SET NULL"), nullable=True
    )
    to_facility_id: Mapped[int | None] = mapped_column(
        ForeignKey("facilities.id", ondelete="SET NULL"), nullable=True
    )
    urgency_tier: Mapped[str] = mapped_column(String(4), nullable=False)  # L1–L4
    # pending | in_transit | arrived | completed | lost
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    # Offline-sync discipline (docs/03 systemic patch): clients generate an
    # Idempotency-Key (SHA256(worker_id + client_created_at + patient_id)) so
    # a dropped ack on retransmit never creates a duplicate referral.
    idempotency_key: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    # Client-side creation instant; authoritative chronological-order field
    # for offline-queued referrals. `created_at` is the server audit time.
    client_created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    patient = relationship("PatientRecord")
