"""Watched source registry (doc 26 — autonomous source monitoring).

Unifies the per-domain source lists from docs 14/16/25 into one table. Each
row is a governed source checked by the Change Detector on its own cadence;
a detected change re-triggers the existing pipeline for that source_type.
"""
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.models.capacity import JSON_TYPE  # reuse the JSON/JSONB variant


def _uuid_str() -> str:
    import uuid

    return str(uuid.uuid4())


class WatchedSource(Base):
    __tablename__ = "watched_sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    source_url: Mapped[str] = mapped_column(String(500), nullable=False)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False)  # 'rag_corpus' | 'financial_scheme' | 'facility_registry'
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    check_frequency: Mapped[str] = mapped_column(String(20), default="1 day", nullable=False)
    last_change_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)  # 'active' | 'needs_manual_confirmation' | 'unreachable'
    extra: Mapped[dict[str, Any] | None] = mapped_column(JSON_TYPE, nullable=True)