"""ASHA worker directory profile (public discovery + registration flow).

Separate from the auth `User` row: a user with role PENDING_ASHA owns one
profile that starts inactive and becomes visible in public discovery only
after an admin activates the account.
"""
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class AshaWorkerProfile(Base):
    __tablename__ = "asha_worker_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(128), nullable=False)
    phone: Mapped[str] = mapped_column(String(15), nullable=False)  # stored full, masked on read
    village_ward: Mapped[str] = mapped_column(String(128), nullable=False)
    block_tehsil: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    district: Mapped[str] = mapped_column(String(128), nullable=False)
    state: Mapped[str] = mapped_column(String(64), nullable=False)
    nearest_facility_id: Mapped[int | None] = mapped_column(default=None)
    specialities: Mapped[str] = mapped_column(String(512), default="")  # comma-separated: "HBNC,IMNCI,NSSK"
    latitude: Mapped[float | None] = mapped_column(Float, default=None)
    longitude: Mapped[float | None] = mapped_column(Float, default=None)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)  # False until admin approves
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
