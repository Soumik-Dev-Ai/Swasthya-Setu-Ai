"""Governed facility coverage expansion (doc 25 §4).

A repeatable, parameterized capability — "expand facility coverage for
[city/area]" — not a one-off script hardcoded to one city.

Source governance (doc 25 §0 correction #2): structured identity fields
(name, coordinates, tier/type, PM-JAY empanelment) come from a governed
registry (NHA Health Facility Registry — a REST/CSV registry, not page
scraping). Supplementary fields (phone, hours, services) come from the
facility's own official page or verifiable directories.

Verification discipline (same "abstain, don't guess" rule as the rest of the
project):
- Identity fields are mechanically verified; ambiguous/incomplete records
  are flagged for manual confirmation, never auto-published.
- Time-sensitive fields (operating_hours) are stored WITH a snapshot
  timestamp and are never presented as live.
- Static fields (phone, services_offered) are stored without a staleness
  label but only when traceable to a claimed source.
- Any unverifiable supplementary detail is OMITTED (None), not guessed.

The core is a pure function (`verify_records`) so it is fully testable
without a database or network; `persist_records` writes the verified rows.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.facility import Facility, FacilityType

# Rough India bounding box (identical to v2_data._MAP_BOUNDS).
INDIA_BOUNDS = {"min_lat": 8.0, "max_lat": 37.0, "min_lng": 68.0, "max_lng": 97.0}

KNOWN_TYPES = {t.value for t in FacilityType}


@dataclass
class RecordResult:
    source_index: int
    fields: dict[str, Any]
    # "verified" | "rejected" | "needs_manual_confirmation"
    status: str
    reason: str = ""


@dataclass
class AcquisitionReport:
    added: int = 0
    rejected: list[int] = field(default_factory=list)
    flagged: list[int] = field(default_factory=list)
    records: list[RecordResult] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "facilities_added": self.added,
            "rejected_indices": self.rejected,
            "needs_manual_confirmation_indices": self.flagged,
            "per_record": [
                {
                    "source_index": r.source_index,
                    "status": r.status,
                    "reason": r.reason,
                    "fields_populated": sorted(k for k, v in r.fields.items() if v is not None),
                }
                for r in self.records
            ],
        }


def _clean_phone(raw: Any) -> str | None:
    """Norm64 to digits and accept only a plausible 10–13 digit number.

    Anything that doesn't reduce to a clean national number is omitted — a
    wrong phone number is worse than no phone number.
    """
    if raw is None:
        return None
    digits = re.sub(r"\D", "", str(raw))
    if 10 <= len(digits) <= 13:
        return digits
    return None


def _in_bounds(lat: Any, lng: Any) -> bool:
    try:
        la, lo = float(lat), float(lng)
    except (TypeError, ValueError):
        return False
    return INDIA_BOUNDS["min_lat"] <= la <= INDIA_BOUNDS["max_lat"] and INDIA_BOUNDS["min_lng"] <= lo <= INDIA_BOUNDS["max_lng"]


def verify_records(
    source_records: list[dict[str, Any]],
    *,
    snapshot_at: datetime | None = None,
) -> tuple[list[dict[str, Any]], AcquisitionReport]:
    """Verify a batch of raw source records into clean Facility field-dicts.

    Returns (verified_fields, report). Verified fields map 1:1 onto Facility
    constructor kwargs (identity) plus the three supplementary columns.
    """
    snapshot_at = snapshot_at or datetime.now(timezone.utc)
    verified: list[dict[str, Any]] = []
    report = AcquisitionReport()

    for i, rec in enumerate(source_records):
        name = str(rec.get("name") or "").strip()
        lat, lng = rec.get("lat"), rec.get("lng")
        fac_type = str(rec.get("type") or "").strip()

        # Identity: required, mechanically checkable.
        if not name:
            report.records.append(RecordResult(i, {}, "rejected", "missing name"))
            report.rejected.append(i)
            continue
        if not _in_bounds(lat, lng):
            report.records.append(
                RecordResult(i, {}, "needs_manual_confirmation", "coordinates missing or outside India")
            )
            report.flagged.append(i)
            continue
        if fac_type not in KNOWN_TYPES:
            report.records.append(
                RecordResult(i, {}, "needs_manual_confirmation", f"unknown facility type {fac_type!r}")
            )
            report.flagged.append(i)
            continue

        fields: dict[str, Any] = {
            "name": name,
            "type": fac_type,
            "pm_jay_empaneled": bool(rec.get("pm_jay_empaneled", False)),
            "lat": float(lat),
            "lng": float(lng),
            "district": str(rec.get("district") or "").strip(),
            "state": str(rec.get("state") or "").strip(),
            "last_verified_date": datetime.now(timezone.utc),
        }
        if not fields["district"] or not fields["state"]:
            report.records.append(
                RecordResult(i, {}, "needs_manual_confirmation", "missing district or state")
            )
            report.flagged.append(i)
            continue

        # Supplementary — abstain when unverifiable.
        fields["phone"] = _clean_phone(rec.get("phone"))
        fields["services_offered"] = rec.get("services_offered") if isinstance(rec.get("services_offered"), dict) else None
        hours = rec.get("operating_hours")
        if isinstance(hours, dict) and hours:
            fields["operating_hours"] = hours
            fields["hours_snapshot_taken_at"] = snapshot_at
        else:
            fields["operating_hours"] = None
            fields["hours_snapshot_taken_at"] = None

        verified.append(fields)
        report.added += 1
        report.records.append(RecordResult(i, fields, "verified"))

    return verified, report


async def persist_records(
    db: AsyncSession,
    verified_fields: list[dict[str, Any]],
) -> list[Facility]:
    """Write verified rows. Returns the persisted Facility objects."""
    rows = [Facility(**f) for f in verified_fields]
    db.add_all(rows)
    await db.commit()
    for r in rows:
        await db.refresh(r)
    return rows