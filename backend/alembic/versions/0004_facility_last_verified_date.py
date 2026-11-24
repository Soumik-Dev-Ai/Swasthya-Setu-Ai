"""Add last_verified_date to facilities.

Revision ID: 0004_facility_last_verified_date
Revises: 0003_knowledge_etl
Create Date: 2026-09-10

Adds a nullable verified-date column so the API can surface data freshness
(doc 02 §3 / gap-closure Fix 3). Nullable: existing rows have no verified
date on record, and honesty rules forbid inventing one.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004_facility_last_verified_date"
down_revision: Union[str, None] = "0003_knowledge_etl"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "facilities",
        sa.Column("last_verified_date", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("facilities", "last_verified_date")