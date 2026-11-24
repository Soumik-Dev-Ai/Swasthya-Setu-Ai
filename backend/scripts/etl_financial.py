"""CLI: run the Government Financial ETL over docs_raw/financial/ (doc 16 §2.2).

Usage (from backend/):
    python -m scripts.etl_financial
    python -m scripts.etl_financial --folder PATH

Extraction runs only when LLM provider keys are configured; otherwise
documents register (idempotently) and report 'no-extraction'.
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.services.etl_financial import run_financial_etl


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Government financial ETL")
    parser.add_argument("--folder", default=settings.FINANCIAL_CORPUS_DIR)
    args = parser.parse_args()

    async with AsyncSessionLocal() as db:
        report = await run_financial_etl(db, Path(args.folder))

    print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
