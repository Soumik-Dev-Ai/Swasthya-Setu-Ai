#!/usr/bin/env python3
"""
Mojibake Repair Tool v2 — Optimized
Detects and repairs double/triple-encoded Unicode corruption safely,
with backups, dry-run mode, parallelism, and self-verification.
"""

import os
import sys
import json
import shutil
import argparse
import concurrent.futures
from pathlib import Path
from datetime import datetime

try:
    import ftfy
except ImportError:
    print("Installing ftfy...")
    os.system(f'"{sys.executable}" -m pip install ftfy --quiet')
    import ftfy

IGNORE_DIRS = {
    "node_modules", "venv", ".venv", ".git", ".next", "dist", "out",
    "__pycache__", ".agents", "build", ".claude", "vendor", ".tox",
    "coverage", ".pytest_cache", ".mypy_cache"
}

TEXT_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".md", ".mdx",
    ".json", ".jsonc", ".html", ".htm", ".css", ".scss", ".sass",
    ".less", ".txt", ".yml", ".yaml", ".xml", ".svg", ".vue", ".svelte",
    ".php", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".sh",
    ".env", ".ini", ".toml", ".graphql", ".sql"
}

# Real mojibake signatures (proper Unicode literals, not chr() hacks)
MOJIBAKE_SIGNATURES = [
    "â€", "â'", "ÃÂ", "ÂÂ", "'", """, "â€\x9d",
    "–", "—", "…", "é", "è", "ü", "ö", "ä", "ñ",
    "ç", "©", "®", "°", "·", "»", "«", "", "\ufffd",
]

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB guard


class MojibakeRepairTool:
    def __init__(self, root, dry_run=False, backup=True,
                 workers=8, verbose=False):
        self.root = Path(root).resolve()
        self.dry_run = dry_run
        self.backup = backup
        self.workers = workers
        self.verbose = verbose
        self.backup_dir = self.root / f".mojibake_backup_{datetime.now():%Y%m%d_%H%M%S}"
        self.report = {"scanned": 0, "corrupted": 0, "fixed": 0,
                        "failed": [], "skipped_size": 0}
        self.gitignore_patterns = self._load_gitignore()

    def _load_gitignore(self):
        gi = self.root / ".gitignore"
        patterns = []
        if gi.exists():
            for line in gi.read_text(errors="ignore").splitlines():
                line = line.strip()
                if line and not line.startswith("#"):
                    patterns.append(line)
        return patterns

    def _is_ignored(self, path: Path) -> bool:
        rel = path.relative_to(self.root)
        if any(p in IGNORE_DIRS for p in rel.parts):
            return True
        for pattern in self.gitignore_patterns:
            if path.match(pattern) or rel.as_posix().startswith(pattern.strip("/")):
                return True
        return False

    def collect_files(self):
        files = []
        for p in self.root.rglob("*"):
            if p.is_dir():
                continue
            if any(part in IGNORE_DIRS for part in p.parts):
                continue
            if p.suffix.lower() not in TEXT_EXTENSIONS:
                continue
            if self._is_ignored(p):
                continue
            files.append(p)
        return files

    def _has_mojibake(self, text: str) -> bool:
        return any(sig in text for sig in MOJIBAKE_SIGNATURES)

    def _fix_text(self, text: str) -> str:
        if text.startswith("\ufeff"):
            text = text[1:]  # strip BOM

        fixed = ftfy.fix_text(text, normalization="NFC", fix_entities=False)

        # Handle multi-layer (double/triple) mojibake — ftfy is
        # idempotent on clean text, so repeating is safe.
        passes = 0
        while self._has_mojibake(fixed) and passes < 3:
            fixed = ftfy.fix_text(fixed, normalization="NFC")
            passes += 1

        return fixed

    def process_file(self, path: Path):
        result = {"file": str(path), "status": "clean"}
        try:
            size = path.stat().st_size
            if size == 0:
                return result
            if size > MAX_FILE_SIZE:
                result["status"] = "skipped_size"
                return result

            raw = path.read_bytes()

            try:
                text = raw.decode("utf-8")
            except UnicodeDecodeError:
                result["status"] = "not_utf8"  # different problem, don't touch
                return result

            if not self._has_mojibake(text):
                return result  # skip clean files — avoids false positives

            fixed = self._fix_text(text)

            if fixed == text:
                result["status"] = "unchanged"
                return result

            result["status"] = "fixed"

            if not self.dry_run:
                if self.backup:
                    backup_path = self.backup_dir / path.relative_to(self.root)
                    backup_path.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(path, backup_path)
                path.write_text(fixed, encoding="utf-8", newline="\n")

            return result

        except Exception as e:
            result["status"] = "error"
            result["error"] = str(e)
            return result

    def run(self):
        files = self.collect_files()
        self.report["scanned"] = len(files)
        print(f"🔍 Scanning {len(files)} files under {self.root}")

        with concurrent.futures.ThreadPoolExecutor(max_workers=self.workers) as ex:
            futures = {ex.submit(self.process_file, f): f for f in files}
            for fut in concurrent.futures.as_completed(futures):
                res = fut.result()
                if res["status"] == "fixed":
                    self.report["fixed"] += 1
                    print(f"  ✅ Fixed: {Path(res['file']).relative_to(self.root)}")
                elif res["status"] == "error":
                    self.report["failed"].append(res)
                    print(f"  🔴 Error: {res['file']} — {res['error']}")
                elif res["status"] == "skipped_size":
                    self.report["skipped_size"] += 1
                elif res["status"] == "not_utf8" and self.verbose:
                    print(f"  ⚠️  Not valid UTF-8 (separate issue): {res['file']}")

        self.report["corrupted"] = self.report["fixed"] + len(self.report["failed"])
        self._write_report()
        self._print_summary()
        return self.report

    def _write_report(self):
        report_path = self.root / "mojibake_repair_report.json"
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump({**self.report, "timestamp": datetime.now().isoformat(),
                       "dry_run": self.dry_run}, f, indent=2)

    def _print_summary(self):
        print("\n" + "=" * 50)
        print("MOJIBAKE REPAIR SUMMARY")
        print("=" * 50)
        print(f"  Files scanned:   {self.report['scanned']}")
        print(f"  Corrupted found: {self.report['corrupted']}")
        tag = " (DRY RUN — no files written)" if self.dry_run else ""
        print(f"  Fixed:           {self.report['fixed']}{tag}")
        print(f"  Failed:          {len(self.report['failed'])}")
        print(f"  Skipped (size):  {self.report['skipped_size']}")
        if self.backup and not self.dry_run and self.report["fixed"] > 0:
            print(f"  Backup dir:      {self.backup_dir}")
        print("=" * 50)


def verify(root):
    """Self-verification: re-scan after fixing to confirm resolution."""
    tool = MojibakeRepairTool(root, dry_run=True, backup=False)
    remaining = 0
    for f in tool.collect_files():
        try:
            text = f.read_bytes().decode("utf-8", errors="ignore")
            if tool._has_mojibake(text):
                remaining += 1
                print(f"  ⚠️  Still corrupted: {f.relative_to(tool.root)}")
        except Exception:
            continue

    if remaining == 0:
        print("\n✅ VERIFICATION PASSED — No mojibake remains.")
    else:
        print(f"\n🔴 VERIFICATION FAILED — {remaining} file(s) still corrupted. Re-run the script.")
    return remaining == 0


def main():
    parser = argparse.ArgumentParser(description="Mojibake Repair Tool")
    parser.add_argument("path", nargs="?", default=".", help="Project root path")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, no writes")
    parser.add_argument("--no-backup", action="store_true", help="Skip backup creation")
    parser.add_argument("--workers", type=int, default=8, help="Parallel threads")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    tool = MojibakeRepairTool(
        root=args.path, dry_run=args.dry_run,
        backup=not args.no_backup, workers=args.workers, verbose=args.verbose,
    )
    tool.run()

    if not args.dry_run and tool.report["fixed"] > 0:
        print("\n🔍 Running self-verification pass...")
        verify(args.path)


if __name__ == "__main__":
    main()
