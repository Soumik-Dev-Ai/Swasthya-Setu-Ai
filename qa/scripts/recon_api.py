#!/usr/bin/env python3
"""Phase 1b — list real backend routes from /openapi.json so endpoint regexes and paths in .env.qa can be confirmed, not guessed."""
import json
import requests
from common import API, RESULTS

RESULTS.joinpath("recon").mkdir(parents=True, exist_ok=True)
try:
    spec = requests.get(API + "/openapi.json", timeout=10).json()
except Exception as e:  # noqa
    print("Could not read /openapi.json:", e)
    raise SystemExit(0)

routes = sorted((m.upper() + " " + p) for p, ms in spec.get("paths", {}).items() for m in ms)
(RESULTS / "recon" / "api_routes.json").write_text(json.dumps(routes, indent=2))
print(f"{len(routes)} routes written to results/recon/api_routes.json")
for kw in ("intent", "reason", "triage", "refresh", "login", "approve", "patient", "cost", "scheme", "facilit", "follow", "referral", "watched"):
    hits = [r for r in routes if kw in r.lower()]
    if hits:
        print(f"  [{kw}] " + " | ".join(hits[:6]))
