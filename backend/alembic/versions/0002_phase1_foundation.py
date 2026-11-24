"""Phase 1 foundation: safety_override_log + FR-9..FR-12 tables.

Revision ID: 0002_phase1_foundation
Revises: 0001_baseline
Create Date: 2026-09-06

Adds:
- safety_override_log        (docs/01 §1.5 — audit finding #6)
- patient_records            (docs/03 §6.2 — FR-9)
- patient_events             (docs/03 §6.2 — FR-9)
- referrals                  (docs/03 §6.2 — FR-10)
- follow_up_worklist         (docs/03 §6.2 — FR-11)
- facility_capacity_snapshot (docs/03 §6.2 — FR-12)

Documented deviations from the doc SQL (see CHANGELOG.md):
- FK references to the doc's `hospitals` table point at the real
  `facilities` table instead (no `hospitals` table exists in v1).
- `created_by` / `assigned_worker_id` are Integer FKs to `users.id`,
  because the real `users.id` is Integer, not UUID.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0002_phase1_foundation"
down_revision: Union[str, None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

JSON_TYPE = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    # --- safety_override_log -------------------------------------------------
    op.create_table(
        "safety_override_log",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("triage_event_id", sa.Uuid(), nullable=True),
        sa.Column("override_type", sa.String(length=40), nullable=False),
        sa.Column("text_signal", sa.String(length=20), nullable=True),
        sa.Column("vision_signal", sa.String(length=20), nullable=True),
        sa.Column("triggered_keywords", JSON_TYPE, nullable=False),
        sa.Column("symptoms_hash", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_safety_override_log_created_at"),
        "safety_override_log",
        ["created_at"],
        unique=False,
    )

    # --- patient_records (FR-9) ----------------------------------------------
    op.create_table(
        "patient_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("demographic_hash", sa.String(length=128), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=True),
        sa.Column("age_band", sa.String(length=20), nullable=True),
        sa.Column("risk_flags", JSON_TYPE, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("demographic_hash"),
    )

    # --- patient_events (FR-9) ------------------------------------------------
    op.create_table(
        "patient_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("patient_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("facility_id", sa.Integer(), nullable=True),
        sa.Column("payload", JSON_TYPE, nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["patient_id"], ["patient_records.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["facility_id"], ["facilities.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_patient_events_patient_created"),
        "patient_events",
        ["patient_id", "created_at"],
        unique=False,
    )

    # --- referrals (FR-10) -----------------------------------------------------
    op.create_table(
        "referrals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("patient_id", sa.Uuid(), nullable=False),
        sa.Column("from_facility_id", sa.Integer(), nullable=True),
        sa.Column("to_facility_id", sa.Integer(), nullable=True),
        sa.Column("urgency_tier", sa.String(length=4), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("idempotency_key", sa.String(length=64), nullable=True),
        sa.Column("client_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["patient_id"], ["patient_records.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["from_facility_id"], ["facilities.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["to_facility_id"], ["facilities.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index(op.f("ix_referrals_patient_id"), "referrals", ["patient_id"], unique=False)

    # --- follow_up_worklist (FR-11) -------------------------------------------
    op.create_table(
        "follow_up_worklist",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("patient_id", sa.Uuid(), nullable=False),
        sa.Column("reason", sa.String(length=60), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("resolved", sa.Boolean(), nullable=False),
        sa.Column("assigned_worker_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["patient_id"], ["patient_records.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_worker_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_follow_up_worklist_patient_id"), "follow_up_worklist", ["patient_id"], unique=False
    )
    op.create_index(
        op.f("ix_follow_up_worklist_due_date"), "follow_up_worklist", ["due_date"], unique=False
    )

    # --- facility_capacity_snapshot (FR-12) ------------------------------------
    op.create_table(
        "facility_capacity_snapshot",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("facility_id", sa.Integer(), nullable=False),
        sa.Column("diagnostic_capacity", JSON_TYPE, nullable=False),
        sa.Column("medicine_stock", JSON_TYPE, nullable=False),
        sa.Column("snapshot_taken_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(length=60), nullable=True),
        sa.ForeignKeyConstraint(["facility_id"], ["facilities.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_facility_capacity_snapshot_facility_id"),
        "facility_capacity_snapshot",
        ["facility_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_facility_capacity_snapshot_facility_id"),
        table_name="facility_capacity_snapshot",
    )
    op.drop_table("facility_capacity_snapshot")
    op.drop_index(op.f("ix_follow_up_worklist_due_date"), table_name="follow_up_worklist")
    op.drop_index(op.f("ix_follow_up_worklist_patient_id"), table_name="follow_up_worklist")
    op.drop_table("follow_up_worklist")
    op.drop_index(op.f("ix_referrals_patient_id"), table_name="referrals")
    op.drop_table("referrals")
    op.drop_index(op.f("ix_patient_events_patient_created"), table_name="patient_events")
    op.drop_table("patient_events")
    op.drop_table("patient_records")
    op.drop_index(op.f("ix_safety_override_log_created_at"), table_name="safety_override_log")
    op.drop_table("safety_override_log")
