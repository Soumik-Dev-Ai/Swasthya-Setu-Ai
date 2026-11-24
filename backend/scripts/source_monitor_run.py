"""Doc 26 §5 — scheduled entry point for the Change Detector.

Run the registry check against `watched_sources`, then exit non-zero if any
source is now unreachable or needs manual confirmation — so the GitHub
Actions run fails VISIBLY rather than leaving a silent DB flag.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.database import AsyncSessionLocal
from app.services.source_monitor import run_registry


async def _main() -> int:
    async with AsyncSessionLocal() as db:
        counts = await run_registry(db)
        print("checked:", counts)

        # Anything still lagging → fail the workflow run visibly.
        from sqlalchemy import select
        from app.models.watched_source import WatchedSource

        rows = (await db.execute(select(WatchedSource))).scalars().all()
        bad = [r for r in rows if r.status in ("needs_manual_confirmation", "unreachable")]
        if bad:
            for r in bad:
                print(f"FLAGGED {r.status:26} {r.source_type:18} {r.source_url}")
            return 1
        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_main()))