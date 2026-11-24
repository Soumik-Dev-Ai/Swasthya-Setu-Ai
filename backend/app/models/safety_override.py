"""Persistent audit log for deterministic-safety-gate override events.

Purpose (docs/01_AUDIT_KEEP_KILL.md finding #6): every time the safety
layer's authority is exercised over an AI signal — a blocked downgrade or
a caution-ward escalation — one row lands here. This turns "the safety
gate works" from an assertion into an auditable, countable fact, and gives
the demo a concrete artifact ("our override fired N times").

Privacy: no raw symptom text is stored — only a SHA-256 digest, which is
enough for dedup/correlation without retaining patient input.
"""
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON, Uuid

from app.db.database import Base

# JSONB on Postgres, JSON elsewhere (same portability pattern as asha_records).
JSON_TYPE = JSON().with_variant(JSONB(), "postgresql")


class SafetyOverrideLog(Base):
    __tablename__ = "safety_override_log"

    id: Mapped[Any] = mapped_column(Uuid, primary_key=True, default=uuid4)
    # Free reference to the originating triage session when one exists.
    # Nullable and unenforced: the v3 triage path is intentionally
    # write-free, so most rows will have no linked session row.
    triage_event_id: Mapped[Any | None] = mapped_column(Uuid, nullable=True)
    # e.g. "vision_downgrade_blocked" | "vision_escalated" | "frontend_flag_forced"
    override_type: Mapped[str] = mapped_column(String(40), nullable=False)
    # What the deterministic text scan found ("red_flag" | "clear").
    text_signal: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # What the vision cascade reported ("emergency" | "non_serious" | "uncertain" | None).
    vision_signal: Mapped[str | None] = mapped_column(String(20), nullable=True)
    triggered_keywords: Mapped[list[str]] = mapped_column(JSON_TYPE, nullable=False, default=list)
    symptoms_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
