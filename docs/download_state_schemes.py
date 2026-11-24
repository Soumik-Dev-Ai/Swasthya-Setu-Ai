#!/usr/bin/env python3
"""
Downloads state/UT health scheme documents listed in 21_state_scheme_registry.csv.
Only attempts a download when official_portal_url is populated — this script will
NOT guess a URL for an entity that hasn't been verified. Run it again any time
the registry gets more URLs filled in; it's designed to be re-run incrementally
as research completes, not as a one-shot.

Usage: python3 download_state_schemes.py
Requires: pip install requests
"""

import csv
import os
import sys

try:
    import requests
except ImportError:
    print("Missing dependency. Run: pip install requests")
    sys.exit(1)

REGISTRY_PATH = "21_state_scheme_registry.csv"
OUTPUT_DIR = "docs_raw/financial/states"


def slugify(name: str) -> str:
    return name.lower().replace(" ", "_").replace("(", "").replace(")", "").replace("/", "_")


def main():
    if not os.path.exists(REGISTRY_PATH):
        print(f"Registry not found at {REGISTRY_PATH} — place it in the working directory first.")
        sys.exit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    downloaded, skipped_no_url, skipped_not_researched = [], [], []

    with open(REGISTRY_PATH, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            state = row["state_ut"]
            url = row.get("official_portal_url", "").strip()
            status = row.get("research_status", "").strip()

            if url:
                filename = f"{slugify(state)}.pdf"
                filepath = os.path.join(OUTPUT_DIR, filename)
                try:
                    resp = requests.get(url, timeout=30, allow_redirects=True)
                    resp.raise_for_status()
                    with open(filepath, "wb") as out:
                        out.write(resp.content)
                    downloaded.append(state)
                    print(f"[OK] {state} -> {filepath}")
                except Exception as e:
                    print(f"[FAILED] {state} -> {url} ({e})")
            elif status == "name_identified":
                skipped_no_url.append(state)
            else:
                skipped_not_researched.append(state)

    print("\n--- Summary ---")
    print(f"Downloaded: {len(downloaded)}")
    print(f"Scheme name known, URL still needed ({len(skipped_no_url)}): {', '.join(skipped_no_url)}")
    print(f"Not yet researched at all ({len(skipped_not_researched)}): {', '.join(skipped_not_researched)}")
    print(
        "\nThis is expected on first run — the registry currently has 0 verified "
        "official URLs for state schemes. Fill in official_portal_url for any row "
        "as you (or your agent, or a follow-up research pass) verify it, then re-run "
        "this script — it will only attempt what's actually populated."
    )


if __name__ == "__main__":
    main()
