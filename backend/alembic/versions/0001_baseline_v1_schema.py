"""Baseline: the existing v1/v2 schema exactly as it exists in models.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-09-06

This migration makes `alembic upgrade head` the single source of truth for
database schema (production Postgres on Neon per docs/03 §14), replacing
the dev-only `create_all` bootstrap path. Table definitions mirror the SQLAlchemy
models 1:1; JSON columns render as JSONB on PostgreSQL via `.with_variant`.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

JSON_TYPE = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    op.create_table(
        "schemes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("coverage_rules", sa.Text(), nullable=False),
        sa.Column("eligibility_notes", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_schemes_name"), "schemes", ["name"], unique=True)

    op.create_table(
        "facilities",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("pm_jay_empaneled", sa.Boolean(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("district", sa.String(length=128), nullable=False),
        sa.Column("state", sa.String(length=128), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "triage_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("urgency_tier", sa.String(length=16), nullable=False),
        sa.Column("symptom_category", sa.String(length=64), nullable=False),
        sa.Column("region", sa.String(length=128), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("device_local_id", sa.String(length=64), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_triage_sessions_urgency_tier"), "triage_sessions", ["urgency_tier"], unique=False
    )
    op.create_index(
        op.f("ix_triage_sessions_symptom_category"),
        "triage_sessions",
        ["symptom_category"],
        unique=False,
    )
    op.create_index(
        op.f("ix_triage_sessions_timestamp"), "triage_sessions", ["timestamp"], unique=False
    )
    op.create_index(
        op.f("ix_triage_sessions_device_local_id"),
        "triage_sessions",
        ["device_local_id"],
        unique=False,
    )

    op.create_table(
        "asha_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("worker_id", sa.Integer(), nullable=False),
        sa.Column("record_type", sa.String(length=64), nullable=False),
        sa.Column("structured_fields", JSON_TYPE, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("device_local_id", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["worker_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_asha_records_worker_id"), "asha_records", ["worker_id"], unique=False)
    op.create_index(
        op.f("ix_asha_records_record_type"), "asha_records", ["record_type"], unique=False
    )
    op.create_index(op.f("ix_asha_records_created_at"), "asha_records", ["created_at"], unique=False)
    op.create_index(
        op.f("ix_asha_records_device_local_id"), "asha_records", ["device_local_id"], unique=False
    )

    op.create_table(
        "pricing",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("facility_id", sa.Integer(), nullable=False),
        sa.Column("scheme_id", sa.Integer(), nullable=True),
        sa.Column("procedure_category", sa.String(length=128), nullable=False),
        sa.Column("base_cost", sa.Float(), nullable=False),
        sa.Column("subsidized_cost", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["facility_id"], ["facilities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scheme_id"], ["schemes.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_pricing_facility_id"), "pricing", ["facility_id"], unique=False)
    op.create_index(op.f("ix_pricing_scheme_id"), "pricing", ["scheme_id"], unique=False)
    op.create_index(
        op.f("ix_pricing_procedure_category"), "pricing", ["procedure_category"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_pricing_procedure_category"), table_name="pricing")
    op.drop_index(op.f("ix_pricing_scheme_id"), table_name="pricing")
    op.drop_index(op.f("ix_pricing_facility_id"), table_name="pricing")
    op.drop_table("pricing")
    op.drop_index(op.f("ix_asha_records_device_local_id"), table_name="asha_records")
    op.drop_index(op.f("ix_asha_records_created_at"), table_name="asha_records")
    op.drop_index(op.f("ix_asha_records_record_type"), table_name="asha_records")
    op.drop_index(op.f("ix_asha_records_worker_id"), table_name="asha_records")
    op.drop_table("asha_records")
    op.drop_index(op.f("ix_triage_sessions_device_local_id"), table_name="triage_sessions")
    op.drop_index(op.f("ix_triage_sessions_timestamp"), table_name="triage_sessions")
    op.drop_index(op.f("ix_triage_sessions_symptom_category"), table_name="triage_sessions")
    op.drop_index(op.f("ix_triage_sessions_urgency_tier"), table_name="triage_sessions")
    op.drop_table("triage_sessions")
    op.drop_table("facilities")
    op.drop_index(op.f("ix_schemes_name"), table_name="schemes")
    op.drop_table("schemes")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_table("users")
