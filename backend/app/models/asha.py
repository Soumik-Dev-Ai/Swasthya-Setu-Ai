"""ASHA worker records synced from mobile devices (offline-first)."""
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.database import Base

# Use JSONB on Postgres, JSON elsewhere (SQLite). Keeps the schema portable.
JSON_TYPE = JSON().with_variant(JSONB(), "postgresql")


class AshaRecord(Base):
    __tablename__ = "asha_records"
    __table_args__ = ({"sqlite_autoincrement": True},)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    worker_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    record_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    structured_fields: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    # device_local_id together with worker_id is the deduplication key for
    # intermittently synced offline records.
    device_local_id: Mapped[str] = mapped_column(
        String(64), index=True, nullable=False
    )
