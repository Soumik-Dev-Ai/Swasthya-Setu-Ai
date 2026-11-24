"""Government health scheme model."""
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


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
    # doc 25 §2: verified enrollment mechanism + portal URL (null unless a
    # verified honest self-service signup URL exists — never a guessed link).
    registration_portal_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    enrollment_method: Mapped[str] = mapped_column(String(30), nullable=False, default="unknown")
