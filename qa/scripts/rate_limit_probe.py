#!/usr/bin/env python3
"""Phase 6b — find the EXACT request number at which the limiter first returns 429, for the default and the heavy tier.
Documented limits: 200/min default, 10/min search-heavy. A 429 appearing at some other number is a finding."""
import time
import requests
from common import API, env, record

TIERS = [
    ("P6-RATELIMIT-DEFAULT", env("RATE_DEFAULT_PATH", "/health"), int(env("RATE_DEFAULT_LIMIT", "200")), env("RATE_DEFAULT_METHOD", "GET")),
    ("P6-RATELIMIT-HEAVY", env("RATE_HEAVY_PATH", ""), int(env("RATE_HEAVY_LIMIT", "10")), env("RATE_HEAVY_METHOD", "POST" if "search" in env("RATE_HEAVY_PATH", "") else "GET")),
]
for id, path, limit, method in TIERS:
    claim = f"Limiter returns 429 at request #{limit + 1} within one minute for {path or '(heavy path unset)'}"
    if not path:
        record(id, claim, "BLOCKED", {"why": "Set RATE_HEAVY_PATH in .env.qa to a search-heavy endpoint (e.g. facility search)"}); continue
    time.sleep(int(env("RATE_RESET_WAIT", "65")))              # let any previous window drain
    s = requests.Session(); first429 = None; codes = {}
    t0 = time.time()
    payload = {"latitude": 28.6139, "longitude": 77.2090} if method == "POST" else None
    for i in range(1, limit + 40):
        r = s.request(method, API + path, json=payload, timeout=15)
        codes[r.status_code] = codes.get(r.status_code, 0) + 1
        if r.status_code == 429 and first429 is None:
            first429 = i; retry = r.headers.get("Retry-After")
            if i > 1 and r.elapsed.total_seconds() > 1: pass
        if time.time() - t0 > 58: break
    ok = first429 == limit + 1
    record(id, claim, "PASS" if ok else ("FAIL" if first429 else "FAIL"),
           {"path": path, "documentedLimit": limit, "first429AtRequest": first429, "expected": limit + 1,
            "statusCounts": codes, "elapsedSec": round(time.time() - t0, 1),
            "note": "No 429 at all = limiter not active on this path; off-by-N = limit differs from documentation (fixed vs sliding window can legitimately shift by a few)."})
