"""High-risk follow-up worklist (FR-11).

Materialized by a scheduled job — never a live view — so reads stay cheap
and the worklist is stable for the ASHA between syncs.
"""
from datetime import date
from typing import Any
from uuid import uuid4

from sqlalchemy import Boolean, Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from app.db.database import Base


class FollowUpWorklist(Base):
    __tablename__ = "follow_up_worklist"

    id: Mapped[Any] = mapped_column(Uuid, primary_key=True, default=uuid4)
    patient_id: Mapped[Any] = mapped_column(
        ForeignKey("patient_records.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # maternal | child_immunization | chronic_recall
    reason: Mapped[str] = mapped_column(String(60), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    assigned_worker_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
