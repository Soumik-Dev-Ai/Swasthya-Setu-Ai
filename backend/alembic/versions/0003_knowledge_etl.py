"""Phase 3: Knowledge Engine + Government Financial ETL tables.

Revision ID: 0003_knowledge_etl
Revises: 0002_phase1_foundation
Create Date: 2026-09-06

Adds:
- document_registry  (idempotent incremental ingestion, doc 18 Phase 3)
- knowledge_chunks   (clause-level chunks + embeddings for retrieval, doc 14)
- government_costs   (verified government price rows, doc 16 §2.2)

Note on embeddings: stored as JSON text and scored with an in-process
exact cosine scan. This is the deliberate MVP choice — at a few hundred
chunks it is both simpler and fast. The pgvector + HNSW upgrade applies
when the corpus outgrows in-memory scoring (doc 14 §3's own guidance).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_knowledge_etl"
down_revision: Union[str, None] = "0002_phase1_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "document_registry",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("file_hash", sa.String(length=64), nullable=False),
        sa.Column("corpus", sa.String(length=20), nullable=False),
        sa.Column("path", sa.String(length=500), nullable=False),
        sa.Column("chunk_count", sa.Integer(), nullable=False),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("file_hash"),
    )
    op.create_index(op.f("ix_document_registry_file_hash"), "document_registry", ["file_hash"], unique=False)
    op.create_index(op.f("ix_document_registry_corpus"), "document_registry", ["corpus"], unique=False)

    op.create_table(
        "knowledge_chunks",
        sa.Column("chunk_id", sa.String(length=160), nullable=False),
        sa.Column("document_id", sa.Uuid(), nullable=False),
        sa.Column("corpus", sa.String(length=20), nullable=False),
        sa.Column("source_name", sa.String(length=255), nullable=False),
        sa.Column("section_path", sa.String(length=500), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column("embedding_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["document_registry.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("chunk_id"),
    )
    op.create_index(op.f("ix_knowledge_chunks_document_id"), "knowledge_chunks", ["document_id"], unique=False)
    op.create_index(op.f("ix_knowledge_chunks_corpus"), "knowledge_chunks", ["corpus"], unique=False)

    op.create_table(
        "government_costs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("procedure_key", sa.String(length=255), nullable=False),
        sa.Column("amount_inr", sa.Integer(), nullable=True),
        sa.Column("currency", sa.String(length=8), nullable=False),
        sa.Column("source_document", sa.String(length=255), nullable=False),
        sa.Column("grounding_quote", sa.Text(), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=True),
        sa.Column("supersedes", sa.String(length=255), nullable=True),
        sa.Column("last_verified_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("needs_manual_confirmation", sa.Boolean(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_government_costs_procedure_key"), "government_costs", ["procedure_key"], unique=False)
    op.create_index(op.f("ix_government_costs_active"), "government_costs", ["active"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_government_costs_active"), table_name="government_costs")
    op.drop_index(op.f("ix_government_costs_procedure_key"), table_name="government_costs")
    op.drop_table("government_costs")
    op.drop_index(op.f("ix_knowledge_chunks_corpus"), table_name="knowledge_chunks")
    op.drop_index(op.f("ix_knowledge_chunks_document_id"), table_name="knowledge_chunks")
    op.drop_table("knowledge_chunks")
    op.drop_index(op.f("ix_document_registry_corpus"), table_name="document_registry")
    op.drop_index(op.f("ix_document_registry_file_hash"), table_name="document_registry")
    op.drop_table("document_registry")
