"""ASHA worker profiles (public discovery + registration flow).

Revision ID: 0005_asha_profiles
Revises: 0004_facility_last_verified_date
Create Date: 2026-09-10

Creates the asha_worker_profiles directory table, an index on
(district, is_active) for the discovery query, and a FK to users.id.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005_asha_profiles"
down_revision: Union[str, None] = "0004_facility_last_verified_date"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "asha_worker_profiles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=128), nullable=False),
        sa.Column("phone", sa.String(length=15), nullable=False),
        sa.Column("village_ward", sa.String(length=128), nullable=False),
        sa.Column("block_tehsil", sa.String(length=128), nullable=False),
        sa.Column("district", sa.String(length=128), nullable=False),
        sa.Column("state", sa.String(length=64), nullable=False),
        sa.Column("nearest_facility_id", sa.Integer(), nullable=True),
        sa.Column("specialities", sa.String(length=512), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(
        "ix_asha_worker_profiles_district_active",
        "asha_worker_profiles",
        ["district", "is_active"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_asha_worker_profiles_district_active", table_name="asha_worker_profiles")
    op.drop_table("asha_worker_profiles")