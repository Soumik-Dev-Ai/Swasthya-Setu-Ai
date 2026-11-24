"""CLI: ingest the Knowledge Engine corpus (idempotent).

Usage (from backend/):
    python -m scripts.ingest                 # clinical corpus (settings.RAG_CORPUS_DIR)
    python -m scripts.ingest --folder PATH [--corpus clinical|financial]

Safe to re-run at any time; unchanged files are skipped by their SHA-256.
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.services.rag.ingest import ingest_folder


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Ingest the knowledge corpus")
    parser.add_argument("--folder", default=settings.RAG_CORPUS_DIR)
    parser.add_argument("--corpus", default="clinical", choices=["clinical", "financial"])
    args = parser.parse_args()

    async with AsyncSessionLocal() as db:
        report = await ingest_folder(db, Path(args.folder), corpus=args.corpus)

    # Console summary: one line per file plus a rollup.
    print(f"folder:   {report['folder']}")
    print(f"status:   {report['status']}")
    if report["status"] == "ok":
        print(f"ingested: {report['ingested']}   skipped: {report['skipped']}")
        for f in report["files"]:
            detail = f.get("chunks")
            suffix = f" ({detail} chunks)" if detail is not None else ""
            print(f"  - {f['filename']}: {f['status']}{suffix}")


if __name__ == "__main__":
    asyncio.run(_main())
