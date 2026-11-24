"""Knowledge Engine storage: document registry + corpus chunks.

- `document_registry` powers the idempotent incremental ingestion required
  by doc 18 Phase 3: each file's SHA-256 is the dedup key — re-running the
  ingestor on an unchanged corpus inserts nothing.
- `knowledge_chunks` stores clause-level chunks with metadata for the
  grounding verifier. Embeddings are stored as JSON vectors and scored
  in-process (exact cosine) — correct and fast at MVP corpus scale;
  the pgvector index is the documented upgrade path past ~10k chunks.
"""
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.db.database import Base


class DocumentRegistry(Base):
    __tablename__ = "document_registry"

    id: Mapped[Any] = mapped_column(Uuid, primary_key=True, default=uuid4)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    # SHA-256 of file bytes — the idempotency key for ingestion.
    file_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    # "clinical" | "financial"
    corpus: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    chunks = relationship(
        "KnowledgeChunk", back_populates="document", cascade="all, delete-orphan"
    )


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    # Stable, human-traceable chunk id, e.g. "who_imci_chartbook#a3f1c9#c4".
    chunk_id: Mapped[str] = mapped_column(String(160), primary_key=True)
    document_id: Mapped[Any] = mapped_column(
        ForeignKey("document_registry.id", ondelete="CASCADE"), nullable=False, index=True
    )
    corpus: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    source_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Section trail, e.g. "IMCI Chartbook > Assess the sick child > Diarrhoea".
    section_path: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    text: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # JSON list of floats; fixed dimension (settings.EMBEDDING_DIM).
    embedding_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    document = relationship("DocumentRegistry", back_populates="chunks")
