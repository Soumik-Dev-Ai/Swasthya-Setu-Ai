"""Doc 24/25/26 schema additions.

Revision ID: 0006_docs_24_25_26
Revises: 0005_asha_profiles
Create Date: 2026-09-10

- schemes: registration_portal_url + enrollment_method (doc 25 §2)
- facilities: phone, services_offered, operating_hours,
  hours_snapshot_taken_at (doc 25 §4)
- watched_sources: unified source registry (doc 26)
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "0006_docs_24_25_26"
down_revision: Union[str, None] = "0005_asha_profiles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

JSON_VARIANT = sa.JSON().with_variant(JSONB(), "postgresql")


def upgrade() -> None:
    # doc 25 §2 — schemes enrollment provenance.
    op.add_column("schemes", sa.Column("registration_portal_url", sa.String(length=500), nullable=True))
    op.add_column("schemes", sa.Column("enrollment_method", sa.String(length=30), nullable=False, server_default="unknown"))

    # doc 25 §4 — facilities supplementary fields.
    op.add_column("facilities", sa.Column("phone", sa.String(length=20), nullable=True))
    op.add_column("facilities", sa.Column("services_offered", JSON_VARIANT, nullable=True))
    op.add_column("facilities", sa.Column("operating_hours", JSON_VARIANT, nullable=True))
    op.add_column("facilities", sa.Column("hours_snapshot_taken_at", sa.DateTime(timezone=True), nullable=True))

    # doc 26 — watched sources registry.
    op.create_table(
        "watched_sources",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("source_url", sa.String(length=500), nullable=False),
        sa.Column("source_type", sa.String(length=30), nullable=False),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_content_hash", sa.String(length=64), nullable=True),
        sa.Column("check_frequency", sa.String(length=20), nullable=False),
        sa.Column("last_change_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("extra", JSON_VARIANT, nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("watched_sources")
    op.drop_column("facilities", "hours_snapshot_taken_at")
    op.drop_column("facilities", "operating_hours")
    op.drop_column("facilities", "services_offered")
    op.drop_column("facilities", "phone")
    op.drop_column("schemes", "enrollment_method")
    op.drop_column("schemes", "registration_portal_url")