"""Government Financial ETL pipeline (doc 16 §2.2).

Runs offline, on a schedule or on demand — never in a patient's request
path. A user query only ever reads the already-verified rows this
pipeline leaves behind.

Pipeline shape:
  1. idempotent ingestion hash (same registry the clinical corpus uses)
  2. LLM-assisted extraction of candidate rows (cost + grounding_quote +
     date/supersession metadata)
  3. mechanical verification — the grounding quote must exist verbatim in
     the source text (code, not another model)
  4. automated recency resolution:
       P1 verified supersession claims win over the named document's rows
       P2 per-procedure effective-date comparison — later wins
       P3 unresolved/ambiguous → new row flagged needs_manual_confirmation;
          the live table keeps serving the last known-good value

Honesty rule with a test: when no date exists in the source, the
extracted row carries `effective_date = None` — never an invented one.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.government_cost import GovernmentCost
from app.services.provider_registry import get_cascade
from app.services.rag.ingest import ingest_file

logger = logging.getLogger("swasthyasetu")


def _get_extraction_cascade() -> list[tuple[str, str]]:
    """Dynamic — resolved at startup, always points to the best available model."""
    return get_cascade("extraction")

# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------

_EXTRACT_PROMPT = (
    "Extract procedure cost rows from the following government document text.\n"
    "Return ONLY a JSON array on one line, no prose. Each object:\n"
    '{"procedure_key": <short lowercase procedure name>, "amount_inr": <integer rrupees>, '
    '"grounding_quote": <VERBATIM substring of the document containing the figure>, '
    '"effective_date": <"YYYY-MM-DD" or null>, "supersedes": <document reference it replaces, or null>}\n'
    "Rules: never invent a number; never fabricate a date — if no date is "
    "shown, use null. Do not include any prose.\n\nDocument text:\n"
)

_DATE_PATTERNS = (
    re.compile(r"\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b"),          # 2026-01-15
    re.compile(r"\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b"),          # 15-01-2026
    re.compile(r"\b(\d{1,2} [A-Za-z]+ \d{4})\b"),              # 15 January 2026
)

_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}


def parse_effective_date(raw: str | None) -> date | None:
    """Honest date parsing: returns None whenever anything is ambiguous or
    absent. Never constructs a plausible-looking date."""
    if not raw:
        return None
    s = str(raw).strip()
    m = _DATE_PATTERNS[0].match(s)
    if m:
        y, mo, d = m.group(1).split("-")
        try:
            return date(int(y), int(mo), int(d))
        except ValueError:
            return None
    m = _DATE_PATTERNS[1].match(s)
    if m:
        d, mo, y = m.group(1).split("/") if "/" in m.group(1) else m.group(1).split("-")
        try:
            return date(int(y), int(mo), int(d))
        except ValueError:
            return None
    m = _DATE_PATTERNS[2].match(s)
    if m:
        parts = m.group(1).split()
        try:
            return date(int(parts[2]), _MONTHS[parts[1].lower()], int(parts[0]))
        except (ValueError, KeyError, IndexError):
            return None
    return None


async def _extract_rows_with_llm(source_text: str) -> list[dict[str, Any]] | None:
    """LLM-assisted extraction. Returns None when no provider is configured
    or on any failure — the pipeline then writes no rows for the document.

    Failures are logged server-side (but no raw document text is logged)."""
    cascade = _get_extraction_cascade()
    if not cascade:
        return None

    # Phase 1 item 1B: try EVERY configured provider before giving up —
    # a single provider's rate-limit/timeout no longer drops the document.
    for env_key, model in cascade:
        api_key = getattr(settings, env_key, None)
        if not api_key:
            continue
        try:
            import litellm  # type: ignore

            response = await asyncio.wait_for(
                litellm.acompletion(
                    model=model,
                    api_key=api_key,
                    messages=[{"role": "user", "content": _EXTRACT_PROMPT + source_text[:12000]}],
                    temperature=0.0,
                    max_tokens=800,
                ),
                timeout=180.0,  # free-tier slow generation for dense extraction
            )
            raw = (response.choices[0].message.content or "").strip()
            rows = _parse_extracted_rows(raw)
            if rows:
                return rows
            logger.warning("[Cascade] %s produced empty/unparseable extraction. Trying next.", model)
        except Exception as exc:
            logger.warning("[Cascade] %s failed during financial extraction: %s. Trying next.", model, exc)
            continue

    return None


def _parse_extracted_rows(raw: str) -> list[dict[str, Any]] | None:
    """Tolerant parse of the model's output — models under-deliver on the
    'ONLY a JSON array' instruction. Accepts, in order:
      1. a bare JSON array  `[...]`
      2. a wrapper object   `{"rows": [...]}`
      3. line-delimited JSON objects (no outer array)
    """
    raw = raw.strip()
    # strip code fences if the model added them
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw).strip()

    candidate = re.search(r"\[.*\]", raw, re.DOTALL)
    if candidate:
        try:
            rows = json.loads(candidate.group(0))
            if isinstance(rows, list):
                return rows
        except json.JSONDecodeError:
            pass

    try:
        obj = json.loads(raw)
        if isinstance(obj, dict):
            for key in ("rows", "data", "results", "packages"):
                if isinstance(obj.get(key), list):
                    return obj[key]
    except json.JSONDecodeError:
        pass

    # Line-delimited objects: {…}\n{…}\n…
    try:
        lines = [ln.strip() for ln in raw.splitlines() if ln.strip().lstrip("{[").strip()]
        objs = [json.loads(ln) for ln in lines if ln.startswith("{") and ln.endswith("}")]
        if objs:
            return objs
    except json.JSONDecodeError:
        return None
    except Exception:
        pass

    # Truncated array at max_tokens: salvage every complete {…} object.
    return _extract_balanced_objects(raw) or None


def _extract_balanced_objects(raw: str) -> list[dict[str, Any]]:
    """Last-resort parse for a truncated JSON array (output cut off by
    max_tokens mid-object): walk the string and keep every complete `{...}`
    top-level object, dropping the final incomplete one."""
    out: list[dict[str, Any]] = []
    depth = 0
    in_string = False
    esc = False
    start = -1
    for i, ch in enumerate(raw):
        if in_string:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start >= 0:
                try:
                    out.append(json.loads(raw[start : i + 1]))
                except json.JSONDecodeError:
                    pass
                start = -1
    return out


# ---------------------------------------------------------------------------
# Mechanical verification (code, not a model)
# ---------------------------------------------------------------------------

_WS = re.compile(r"\s+")


def _quote_is_verbatim(quote: str, source_text: str) -> bool:
    """The grounding quote must exist in the source text (whitespace-tolerant)."""
    if not quote or not source_text:
        return False
    return _WS.sub(" ", quote.strip()).lower() in _WS.sub(" ", source_text).lower()


# ---------------------------------------------------------------------------
# Recency resolution (doc 16 §2.2 step 4)
# ---------------------------------------------------------------------------


def _normalize_key(key: str) -> str:
    return _WS.sub(" ", (key or "").strip().lower())


async def _resolve_and_write(
    db: AsyncSession, *, candidate: dict[str, Any], source_document: str
) -> str:
    """Write a verified candidate row under the recency rules.

    Returns a status string for the run report.
    """
    key = _normalize_key(str(candidate.get("procedure_key", "")))
    if not key:
        return "skipped-no-key"

    effective = parse_effective_date(candidate.get("effective_date"))
    supersedes = candidate.get("supersedes")
    supersedes = str(supersedes).strip() if supersedes else None

    existing = (
        await db.execute(
            select(GovernmentCost)
            .where(GovernmentCost.procedure_key == key, GovernmentCost.active.is_(True))
        )
    ).scalars().all()

    if not existing:
        flag = effective is None  # honest: first sighting with no date → review
        db.add(
            GovernmentCost(
                procedure_key=key,
                amount_inr=_as_int(candidate.get("amount_inr")),
                source_document=source_document,
                grounding_quote=str(candidate.get("grounding_quote", "")),
                effective_date=effective,
                supersedes=supersedes,
                needs_manual_confirmation=flag,
                active=True,
                version=1,
            )
        )
        return "inserted-first-sighting" + ("-needs-review" if flag else "")

    latest = max(existing, key=lambda r: (r.version, r.last_verified_date))

    # P1 — verified supersession: the candidate names the incumbent's document.
    if supersedes and supersedes.lower() in (latest.source_document or "").lower():
        for row in existing:
            row.active = False
        db.add(
            GovernmentCost(
                procedure_key=key,
                amount_inr=_as_int(candidate.get("amount_inr")),
                source_document=source_document,
                grounding_quote=str(candidate.get("grounding_quote", "")),
                effective_date=effective,
                supersedes=supersedes,
                needs_manual_confirmation=False,
                active=True,
                version=latest.version + 1,
            )
        )
        return "superseded"

    # P2 — both sides have dates: later effective date wins.
    if effective is not None and latest.effective_date is not None:
        if effective > latest.effective_date:
            for row in existing:
                row.active = False
            db.add(
                GovernmentCost(
                    procedure_key=key,
                    amount_inr=_as_int(candidate.get("amount_inr")),
                    source_document=source_document,
                    grounding_quote=str(candidate.get("grounding_quote", "")),
                    effective_date=effective,
                    supersedes=supersedes,
                    needs_manual_confirmation=False,
                    active=True,
                    version=latest.version + 1,
                )
            )
            return "superseded-by-date"
        return "kept-existing-newer-or-equal"

    # P3 — abstain. Flag for review; keep serving the known-good value.
    db.add(
        GovernmentCost(
            procedure_key=key,
            amount_inr=_as_int(candidate.get("amount_inr")),
            source_document=source_document,
            grounding_quote=str(candidate.get("grounding_quote", "")),
            effective_date=effective,
            supersedes=supersedes,
            needs_manual_confirmation=True,
            active=False,
            version=latest.version + 1,
        )
    )
    return "flagged-needs-manual-confirmation"


def _as_int(value: Any) -> int | None:
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


async def run_financial_etl(db: AsyncSession, folder: Path) -> dict[str, Any]:
    """Scan the financial corpus folder; extract+verify only new/changed docs."""
    folder = Path(folder)
    if not folder.exists():
        return {"status": "missing-folder", "folder": str(folder)}

    report: dict[str, Any] = {"status": "ok", "documents": []}
    for pdf in sorted(folder.glob("*.pdf")):
        # The registry drives idempotency — a second run does nothing.
        ingest_result = await ingest_file(db, pdf, corpus="financial")
        if ingest_result.get("status") != "ingested":
            report["documents"].append({"file": pdf.name, "result": ingest_result.get("status")})
            continue

        text = _read_document_text(pdf)
        if not text.strip():
            report["documents"].append({"file": pdf.name, "result": "no-extractable-text"})
            continue

        candidates = await _extract_rows_with_llm(text)
        if candidates is None:
            report["documents"].append(
                {"file": pdf.name, "result": "no-extraction (no provider configured or parse failure)"}
            )
            continue

        outcomes = []
        for candidate in candidates:
            quote = str(candidate.get("grounding_quote", ""))
            if not _quote_is_verbatim(quote, text):
                outcomes.append({"key": candidate.get("procedure_key"), "result": "rejected-unverified-quote"})
                continue
            result = await _resolve_and_write(db, candidate=candidate, source_document=pdf.name)
            outcomes.append({"key": candidate.get("procedure_key"), "result": result})
        report["documents"].append({"file": pdf.name, "result": outcomes})

    await db.commit()
    return report


def _read_document_text(path: Path) -> str:
    try:
        from pypdf import PdfReader

        return "\n".join(page.extract_text() or "" for page in PdfReader(str(path)).pages)
    except Exception:
        return ""


__all__ = ["run_financial_etl", "parse_effective_date"]
