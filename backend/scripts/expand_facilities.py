"""Doc 25 §4 — parameterized facility-coverage expansion CLI.

Usage:
    python -m scripts.expand_facilities --source <json-or-csv> [--report-only]

The source file is a governed registry extract (e.g. NHA Health Facility
Registry dump). This script does NOT scrape live — acquisition data must be
obtained through the governed-source process first (doc 19 / doc 25 §0).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.database import AsyncSessionLocal
from app.services.facility_acquisition import persist_records, verify_records


def _load(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        data = json.loads(text)
        return data if isinstance(data, list) else data.get("facilities", [])
    # CSV fallback
    import csv
    from io import StringIO

    rows = list(csv.DictReader(StringIO(text)))
    # coerce numeric fields
    for r in rows:
        r["lat"] = float(r.get("lat") or 0)
        r["lng"] = float(r.get("lng") or 0)
        r["pm_jay_empaneled"] = str(r.get("pm_jay_empaneled", "")).lower() in ("1", "true", "yes")
        r["services_offered"] = json.loads(r["services_offered"]) if r.get("services_offered") else None
        r["operating_hours"] = json.loads(r["operating_hours"]) if r.get("operating_hours") else None
    return rows


async def _run(path: Path, report_only: bool) -> None:
    records = _load(path)
    verified, report = verify_records(records)
    if not report_only and verified:
        async with AsyncSessionLocal() as db:
            persisted = await persist_records(db, verified)
            print(f"persisted {len(persisted)} facility rows")
    print(json.dumps(report.to_dict(), indent=2, ensure_ascii=False))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True, type=Path)
    ap.add_argument("--report-only", action="store_true")
    args = ap.parse_args()
    asyncio.run(_run(args.source, args.report_only))


if __name__ == "__main__":
    main()