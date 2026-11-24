"""Government-verified procedure cost rows (doc 16 Task 2 target table).

The query-time financial path only ever reads this table — an LLM helps
*populate* it offline (with mechanical verification + recency resolution),
but no model is ever in the answer path (docs/15 §4).

Every row may carry an honest `needs_manual_confirmation` flag — the
pipeline abstains rather than guessing, and keeps serving the last
known-good value while the flag is set.
"""
from datetime import date, datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from app.db.database import Base


class GovernmentCost(Base):
    __tablename__ = "government_costs"

    id: Mapped[Any] = mapped_column(Uuid, primary_key=True, default=uuid4)
    # Normalized procedure/scheme key, e.g. "cgms dialysis session".
    procedure_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    amount_inr: Mapped[int | None] = mapped_column(Integer, nullable=True)  # NULL = not stated
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="INR")
    # Provenance / verification (doc 12 §A.3 double-lock grounding).
    source_document: Mapped[str] = mapped_column(String(255), nullable=False)
    grounding_quote: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Recency resolution (doc 16 §2.2): honest nulls, not guesses.
    effective_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    supersedes: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_verified_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    # Set when recency could not be resolved; the pipeline keeps serving
    # the previous row and this one stays out of the query path.
    needs_manual_confirmation: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    # Only the newest verified row per procedure_key is active.
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
