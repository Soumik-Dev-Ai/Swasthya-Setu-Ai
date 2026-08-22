"""Anonymized triage session log (no PII)."""
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class TriageSession(Base):
    __tablename__ = "triage_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    urgency_tier: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    symptom_category: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    region: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    # Optional link to the ASHA record / device-local id that produced this session.
    device_local_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
