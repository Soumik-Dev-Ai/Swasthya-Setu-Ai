"""Pricing model: base vs subsidized cost per procedure category (optionally per scheme)."""
from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.facility import Facility
    from app.models.scheme import Scheme


class Pricing(Base):
    __tablename__ = "pricing"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    facility_id: Mapped[int] = mapped_column(
        ForeignKey("facilities.id", ondelete="CASCADE"), index=True, nullable=False
    )
    scheme_id: Mapped[int | None] = mapped_column(
        ForeignKey("schemes.id", ondelete="SET NULL"), index=True, nullable=True
    )
    procedure_category: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    base_cost: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    subsidized_cost: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    facility: Mapped["Facility"] = relationship("Facility", back_populates="pricing")
    scheme: Mapped["Scheme | None"] = relationship("Scheme")
