"""Government health scheme model."""
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Scheme(Base):
    __tablename__ = "schemes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    coverage_rules: Mapped[str] = mapped_column(Text, nullable=False, default="")
    eligibility_notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
