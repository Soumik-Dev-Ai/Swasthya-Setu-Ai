"""Idempotent incremental ingestion (doc 18 Phase 3 item 1).

A `document_registry` row keyed by the file's SHA-256 is the only source
of truth about what's been ingested. Behavior:

- File hash already registered → skipped entirely (no re-chunk, no re-embed).
- Same filename with a NEW hash (revised document) → the old document's
  chunks are deleted (cascade) and the new version is ingested from
  scratch; the registry row is replaced.
- Anything else → chunk, embed, store.

The corpus scale of this MVP (hundreds of chunks) makes a full re-embed of
a changed document the correct, simple answer — no diffing.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge import DocumentRegistry, KnowledgeChunk
from app.services.rag.chunker import chunk_document
from app.services.rag.embeddings import embed_texts


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def _extract_pdf_text(path: Path) -> str:
    """Extract plain text from a PDF. Returns '' when the file is not a
    readable PDF — ingestion then records zero chunks rather than crashing."""
    try:
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        return ""


async def ingest_file(db: AsyncSession, path: Path, *, corpus: str) -> dict[str, Any]:
    """Ingest a single document. Idempotent on file hash."""
    path = Path(path)
    if not path.exists():
        return {"filename": path.name, "status": "missing"}
    if not path.name.lower().endswith(".pdf"):
        return {"filename": path.name, "status": "skipped-non-pdf"}

    file_hash = sha256_file(path)

    existing = await db.scalar(
        select(DocumentRegistry).where(DocumentRegistry.file_hash == file_hash)
    )
    if existing is not None:
        return {"filename": path.name, "status": "skipped-unchanged", "document_id": str(existing.id)}

    # Same filename, different content → replace the old version's rows.
    # Children are deleted explicitly: ORM cascades fire only on ORM-level
    # deletes, and SQLite ships with FK enforcement off — a bulk delete of
    # the parent alone would orphan (and then collide with) chunk rows.
    stale = await db.scalar(
        select(DocumentRegistry).where(DocumentRegistry.filename == path.name)
    )
    if stale is not None:
        old_id = stale.id
        await db.execute(delete(KnowledgeChunk).where(KnowledgeChunk.document_id == old_id))
        await db.execute(delete(DocumentRegistry).where(DocumentRegistry.id == old_id))
        await db.flush()

    text = _extract_pdf_text(path)
    # Only the clinical corpus is embedding/retrieval material; the financial
    # corpus exists purely for the ETL's provenance table, and chunking hundreds
    # of thousands of chars into e5 vectors would be wasted compute + storage.
    chunks = chunk_document(text, source_name=path.stem) if corpus == "clinical" else []

    doc = DocumentRegistry(
        filename=path.name,
        file_hash=file_hash,
        corpus=corpus,
        path=str(path),
        chunk_count=len(chunks),
    )
    db.add(doc)
    await db.flush()  # doc.id needed below

    if chunks:
        vectors = embed_texts([c.text for c in chunks])
        for chunk, vector in zip(chunks, vectors):
            db.add(
                KnowledgeChunk(
                    chunk_id=chunk.chunk_id,
                    document_id=doc.id,
                    corpus=corpus,
                    source_name=chunk.source_name,
                    section_path=chunk.section_path,
                    text=chunk.text,
                    token_count=chunk.token_count,
                    embedding_json=json.dumps(vector),
                )
            )
    await db.flush()
    return {
        "filename": path.name,
        "status": "ingested",
        "document_id": str(doc.id),
        "chunks": len(chunks),
    }


async def ingest_folder(db: AsyncSession, folder: Path, *, corpus: str) -> dict[str, Any]:
    """Ingest every PDF in a folder. Safe to re-run any number of times."""
    folder = Path(folder)
    if not folder.exists():
        return {"folder": str(folder), "status": "missing", "files": []}
    results = []
    for pdf in sorted(folder.glob("*.pdf")):
        results.append(await ingest_file(db, pdf, corpus=corpus))
    await db.commit()
    ingested = sum(1 for r in results if r.get("status") == "ingested")
    skipped = sum(1 for r in results if r.get("status") == "skipped-unchanged")
    return {
        "folder": str(folder),
        "status": "ok",
        "ingested": ingested,
        "skipped": skipped,
        "files": results,
    }
