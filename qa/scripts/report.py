#!/usr/bin/env python3
"""Phase 8 — build results/REPORT.md. Latest result per check id wins.
Blueprint reconciliation uses claim_map.json (the agent fills it from the blueprint's 30 audit points)."""
import json, collections
from common import ROOT, RESULTS

rows = {}
for line in open(RESULTS / "results.jsonl", encoding="utf-8"):
    if not line.strip():
        continue
    r = json.loads(line); rows[r["id"]] = r
order = ["P0", "P2", "P3", "P4", "P5", "P6", "P7"]
by = collections.defaultdict(list)
for r in rows.values():
    by[r["id"].split("-")[0]].append(r)
cnt = collections.Counter(r["status"] for r in rows.values())
icon = {"PASS": "PASS", "FAIL": "**FAIL**", "PARTIAL": "PARTIAL", "BLOCKED": "BLOCKED"}

out = ["# SwasthyaSetu QA Report", "",
       f"Checks executed: **{len(rows)}**  |  PASS {cnt['PASS']}  |  FAIL {cnt['FAIL']}  |  PARTIAL {cnt['PARTIAL']}  |  BLOCKED {cnt['BLOCKED']}", "",
       "BLOCKED and PARTIAL are **not** passes. BLOCKED = the check could not run; PARTIAL = only part of the claim was demonstrated.", ""]

f2 = rows.get("P2-FLOW2-ENDPOINTS")
if f2:
    out += ["## Flow 2 contradiction (resolved first)", f"**{f2['status']}** — {f2['evidence'].get('verdict')}", "",
            "Observed request sequence:", *[f"- `{s}`" for s in f2["evidence"].get("sequence", [])], ""]

fails = [r for r in rows.values() if r["status"] == "FAIL"]
out += ["## Failures (fix list)", *(f"- **{r['id']}** — {r['claim']}" for r in fails), "" if fails else "None.\n"]

for ph in order:
    if ph not in by:
        continue
    out += [f"## {ph}", "| Check | Status | Claim |", "|---|---|---|"]
    out += [f"| {r['id']} | {icon[r['status']]} | {r['claim']} |" for r in sorted(by[ph], key=lambda x: x["id"])]
    out.append("")

cm = ROOT / "claim_map.json"
summary = {"executed": len(rows), **cnt}
if cm.exists():
    points = json.loads(cm.read_text())["points"]
    conf, contra, unk = [], [], []
    for p in points:
        st = [rows[c]["status"] if c in rows else "MISSING" for c in p["checks"]] or ["MISSING"]
        (contra if "FAIL" in st else conf if all(s == "PASS" for s in st) else unk).append(p)
    out += ["## Blueprint reconciliation", f"Blueprint claims **{len(points)}/{len(points)} cleared**.",
            f"- Independently confirmed (all mapped checks PASS): **{len(conf)}**",
            f"- Contradicted (at least one mapped check FAIL): **{len(contra)}**",
            f"- Not confirmed (BLOCKED / PARTIAL / no mapped check): **{len(unk)}**", ""]
    for title, lst in (("Contradicted", contra), ("Not confirmed", unk)):
        if lst:
            out += [f"### {title}", *(f"- #{p['n']}: {p['claim']}  → checks: {', '.join(p['checks']) or 'NONE'}" for p in lst), ""]
    summary.update(blueprint_total=len(points), confirmed=len(conf), contradicted=len(contra), not_confirmed=len(unk))
else:
    out += ["## Blueprint reconciliation", "claim_map.json not found: confirmed-vs-claimed tally cannot be computed. Create it from the blueprint's 30 audit points (see claim_map.example.json).", ""]

(RESULTS / "REPORT.md").write_text("\n".join(out))
(RESULTS / "summary.json").write_text(json.dumps(summary, indent=2))
print("\n".join(out[:6])); print("\nFull report: results/REPORT.md")
raise SystemExit(1 if cnt["FAIL"] else 0)
