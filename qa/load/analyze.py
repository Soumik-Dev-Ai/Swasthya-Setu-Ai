#!/usr/bin/env python3
"""Phase 7c — compare red-flag latency solo vs under mixed load. Reads Locust CSVs produced by run_all.sh:
results/load/solo_stats.csv (red-flag only) and results/load/mixed_stats.csv (mixed traffic)."""
import csv, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "scripts"))
from common import RESULTS, env, record

CLAIM = "Deterministic red-flag path stays fast under concurrent LLM-path load (not serialized behind it)"


def row(file, name):
    p = RESULTS / "load" / file
    if not p.exists():
        return None
    for r in csv.DictReader(open(p)):
        if r["Name"] == name:
            return r
    return None


solo, mixed, amb = row("solo_stats.csv", "triage_redflag"), row("mixed_stats.csv", "triage_redflag"), row("mixed_stats.csv", "triage_ambiguous")
if not solo or not mixed:
    record("P7-LOAD-NONBLOCK", CLAIM, "BLOCKED", {"why": "Locust CSVs missing (is locust installed? pip install locust)"}); raise SystemExit

f = lambda r, k: float(r[k]) if r and r.get(k) not in (None, "", "N/A") else None
solo95, mixed95 = f(solo, "95%"), f(mixed, "95%")
cap_abs = float(env("REDFLAG_P95_MAX_MS", "1000")); cap_rel = float(env("REDFLAG_P95_MAX_RATIO", "3"))
ok = mixed95 is not None and solo95 is not None and mixed95 <= cap_abs and mixed95 <= max(solo95 * cap_rel, 50)
record("P7-LOAD-NONBLOCK", CLAIM, "PASS" if ok else "FAIL", {
    "redflag_solo_p95_ms": solo95, "redflag_mixed_p95_ms": mixed95, "ambiguous_mixed_p95_ms": f(amb, "95%"),
    "redflag_mixed_failures": mixed.get("Failure Count"), "redflag_mixed_requests": mixed.get("Request Count"),
    "thresholds": {"absolute_ms": cap_abs, "ratio_vs_solo": cap_rel},
    "reading": "If red-flag p95 tracks the ambiguous p95 under load, the two paths are being serialized (blocking call in an async handler, shared worker pool, or single worker)."})
