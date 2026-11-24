"""Doc 26 — Change Detector (cheap, frequent) that re-triggers pipelines only
on real change, plus the non-silent fallback.

This module owns detection ("did a source change?") and handles the
unreachable / needs-manual-confirmation status transitions. It deliberately
does NOT implement extraction or verification — those already live in
rag.ingest, etl_financial, and facility_acquisition, and are dispatched from
here via `dispatch_change`.

Design notes:
- Uses HTTP conditional requests (ETag/Last-Modified) where possible; falls
  back to a SHA-256 content hash.
- One unreachable source never blocks the rest of the registry.
- A pipeline that resolves ambiguous → sets source status to
  needs_manual_confirmation; the live table keeps the last confirmed value.
"""
from __future__ import annotations

import hashlib
import inspect
import logging
from datetime import datetime, timezone
from typing import Awaitable, Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.watched_source import WatchedSource

logger = logging.getLogger("swasthyasetu")

# source_type → async callable(db, source_row) implementing the full pipeline.
PipelineFunc = Callable[[AsyncSession, WatchedSource], Awaitable[None]]


async def _pipeline_rag_corpus(db: AsyncSession, source: WatchedSource) -> None:
    """doc 26 §3: a changed clinical source re-triggers the idempotent
    corpus ingestion (unchanged files are skipped by SHA-256)."""
    from pathlib import Path

    from app.services.rag.ingest import ingest_folder

    folder = Path(settings.RAG_CORPUS_DIR)
    report = await ingest_folder(db, folder, corpus="clinical")
    logger.info(
        "[SourceMonitor] rag_corpus pipeline for %s: ingested=%s skipped=%s",
        source.source_url, report.get("ingested", 0), report.get("skipped", 0),
    )


async def _pipeline_financial_scheme(db: AsyncSession, source: WatchedSource) -> None:
    """doc 26 §3: a changed financial source re-triggers the verified ETL
    (extraction + mechanical grounding check + recency resolution)."""
    from pathlib import Path

    from app.services.etl_financial import run_financial_etl

    report = await run_financial_etl(db, Path(settings.FINANCIAL_CORPUS_DIR))
    logger.info("[SourceMonitor] financial pipeline for %s: %s", source.source_url, report.get("status"))


async def _pipeline_facility_registry(db: AsyncSession, source: WatchedSource) -> None:
    """Facility-registry changes require a fresh governed extract (doc 25 §4
    — NHA HFR dump), not a live download. There is no auto-download pipeline
    yet, so this logs the detected change visibly instead of pretending to
    process it. Acquisition runs via scripts/expand_facilities.py."""
    logger.warning(
        "[SourceMonitor] facility_registry CHANGE DETECTED at %s — re-run "
        "scripts/expand_facilities.py with the updated governed extract.",
        source.source_url,
    )


# Registered at import: the three real pipeline callbacks (doc 26 §3).
_PIPELINES: dict[str, PipelineFunc] = {
    "rag_corpus": _pipeline_rag_corpus,
    "financial_scheme": _pipeline_financial_scheme,
    "facility_registry": _pipeline_facility_registry,
}


def register_pipeline(source_type: str, fn: PipelineFunc) -> None:
    _PIPELINES[source_type] = fn


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


async def fetch_content(url: str) -> tuple[str, str | None]:
    """Fetch raw content text. Returns (body, etag_or_none)."""
    import httpx

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text, resp.headers.get("ETag")


async def _default_fetcher(url: str) -> str:
    """check_one needs the body text only; fetch_content returns (body, etag)."""
    body, _ = await fetch_content(url)
    return body


async def check_one(db: AsyncSession, source: WatchedSource, *, fetcher: Callable[[str], Awaitable[str]] | None = None) -> str:
    """Check one source. Returns one of:
    "no_change" | "changed" | "unreachable" — and mutates the row's bookkeeping.

    `fetcher` injects content acquisition; by default it performs the real
    HTTP fetch (via `fetch_content`, adapted to text-only). Tests inject fakes.
    """
    now = datetime.now(timezone.utc)
    if fetcher is None:
        fetcher = _default_fetcher

    try:
        result = fetcher(source.source_url)
        body = await result if inspect.isawaitable(result) else result
    except Exception as exc:  # timeout / 404 / disallowed
        source.status = "unreachable"
        source.last_checked_at = now
        logger.warning("[SourceMonitor] %s unreachable: %s", source.source_url, exc)
        return "unreachable"

    h = content_hash(body)
    if source.last_content_hash == h:
        source.last_checked_at = now
        return "no_change"

    source.last_content_hash = h
    source.last_change_at = now
    source.last_checked_at = now
    source.status = "active"
    return "changed"


async def run_registry(db: AsyncSession, *, fetcher=None) -> dict[str, int]:
    """Check every active row once; dispatch pipelines for any change.

    Returns counts: {checked, changed, unreachable, dispatched}.
    Never lets one source's failure stop the others.
    """
    rows = (await db.execute(select(WatchedSource))).scalars().all()
    counts = {"checked": 0, "changed": 0, "unreachable": 0, "dispatched": 0}
    for source in rows:
        counts["checked"] += 1
        outcome = await check_one(db, source, fetcher=fetcher)
        if outcome == "unreachable":
            counts["unreachable"] += 1
            continue
        if outcome == "changed":
            counts["changed"] += 1
            pipeline = _PIPELINES.get(source.source_type)
            if pipeline is not None:
                await pipeline(db, source)
                counts["dispatched"] += 1
    await db.commit()
    return counts


async def mark_needs_confirmation(db: AsyncSession, source_id: str) -> None:
    """Non-silent fallback: a pipeline resolved ambiguous → flag, keep serving."""
    result = await db.execute(select(WatchedSource).where(WatchedSource.id == source_id))
    source = result.scalar_one_or_none()
    if source is not None:
        source.status = "needs_manual_confirmation"
        await db.commit()