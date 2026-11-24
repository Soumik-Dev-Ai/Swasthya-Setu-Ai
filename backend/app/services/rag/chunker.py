"""Clause-aware chunking for clinical guideline documents (doc 14 §2).

Chunking by the document's own structure (headings/sections), not fixed
token windows — a fixed boundary can split a severity criterion or
contra-indication in half. Overlap keeps boundary context intact.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

_HEADING_RE = re.compile(
    r"^(?:chapter\s+\d+|section\s+\d+|\d+\.\d*\s+|[A-Z][A-Z0-9 ,:/()\-]{4,})",
    re.IGNORECASE,
)

_TARGET_CHARS = 1200
_OVERLAP_RATIO = 0.10


@dataclass(frozen=True)
class Chunk:
    chunk_id: str
    source_name: str
    section_path: str
    text: str

    @property
    def token_count(self) -> int:
        return len(self.text.split())


def _looks_like_heading(line: str) -> bool:
    s = line.strip()
    if not s or len(s) > 90:
        return False
    if s.endswith("."):
        return False
    return bool(_HEADING_RE.match(s))


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")[:60]


def chunk_document(text: str, *, source_name: str) -> list[Chunk]:
    """Split raw document text into clause-level chunks with overlap.

    Returns an empty list for content-free inputs (never raises).
    """
    if not text or not text.strip():
        return []

    lines = text.splitlines()
    sections: list[tuple[str, list[str]]] = []
    current_heading = "Document start"
    bucket: list[str] = []
    for line in lines:
        if _looks_like_heading(line):
            if bucket:
                sections.append((current_heading, bucket))
            current_heading = line.strip()
            bucket = []
        else:
            bucket.append(line)
    if bucket:
        sections.append((current_heading, bucket))

    slug = _slug(source_name)
    chunks: list[Chunk] = []
    for section_heading, section_lines in sections:
        body = "\n".join(section_lines).strip()
        if not body:
            continue
        # Split within a section by target size with trailing overlap.
        start = 0
        step = int(_TARGET_CHARS * (1 - _OVERLAP_RATIO))
        idx = 0
        while start < len(body):
            end = min(len(body), start + _TARGET_CHARS)
            piece = body[start:end].strip()
            if len(piece) < 40 and chunks:
                # Tiny tail: fold into previous chunk instead of a stub.
                prev = chunks[-1]
                chunks[-1] = Chunk(
                    chunk_id=prev.chunk_id,
                    source_name=source_name,
                    section_path=prev.section_path,
                    text=f"{prev.text}\n{piece}".strip(),
                )
                break
            chunks.append(
                Chunk(
                    chunk_id=f"{slug}/c{len(chunks):04d}",
                    source_name=source_name,
                    section_path=section_heading,
                    text=piece,
                )
            )
            idx += 1
            start += step
    return chunks


__all__ = ["Chunk", "chunk_document"]
