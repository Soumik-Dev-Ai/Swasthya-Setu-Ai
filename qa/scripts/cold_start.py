#!/usr/bin/env python3
"""Phase 7a — cold-start latency. Starts the backend fresh N times and measures time-to-first-successful-response
and the first real triage request. With N small a true p95 cannot be computed: report max and median honestly."""
import json, os, signal, subprocess, statistics, sys, time
import requests
from common import API, env, record

CMD = env("BACKEND_START_CMD")
N = int(env("COLD_START_RUNS", "5"))
TARGET = float(env("COLD_START_TARGET_S", "3.0"))
CLAIM = f"First request after a cold start completes in < {TARGET}s"
if not CMD:
    record("P7-COLDSTART", CLAIM, "BLOCKED", {"why": "BACKEND_START_CMD not set (e.g. 'cd ../backend && uvicorn app.main:app --port 8000'). If testing Render free tier, set COLD_START_URL_ONLY=1 and wake it manually instead."}); raise SystemExit

path = env("TRIAGE_PATH", "/api/triage/analyze")
body = {env("TRIAGE_TEXT_FIELD", "symptoms"): "fever for 4 days, dry cough, mild fatigue", **json.loads(env("TRIAGE_EXTRA_JSON", '{"flags": [], "reasoning": true}'))}
first_ok, first_triage = [], []
for i in range(N):
    kw = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if sys.platform == "win32" else {"preexec_fn": os.setsid}
    p = subprocess.Popen(CMD, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **kw)
    t0 = time.time(); up = None
    while time.time() - t0 < 120:
        try:
            if requests.get(API + env("HEALTH_PATH", "/health"), timeout=2).status_code < 500:
                up = time.time() - t0; break
        except Exception:  # noqa
            time.sleep(0.1)
    t1 = time.time()
    try:
        requests.post(API + path, json=body, timeout=60)
    except Exception:  # noqa
        pass
    first_triage.append(time.time() - t1); first_ok.append(up if up is not None else 999)
    if sys.platform == "win32": subprocess.run(["taskkill", "/PID", str(p.pid), "/T", "/F"], capture_output=True)
    else: os.killpg(os.getpgid(p.pid), signal.SIGTERM)
    p.wait(timeout=30); time.sleep(2)

worst = max(a + b for a, b in zip(first_ok, first_triage))
record("P7-COLDSTART", CLAIM, "PASS" if worst < TARGET else "FAIL",
       {"runs": N, "secondsToHealthy": [round(x, 2) for x in first_ok], "firstTriageSeconds": [round(x, 2) for x in first_triage],
        "medianTotal": round(statistics.median(a + b for a, b in zip(first_ok, first_triage)), 2), "maxTotal": round(worst, 2), "targetS": TARGET,
        "caveat": f"{N} samples cannot establish a p95; this is max/median only. Local uvicorn restart is also not the Render free-tier sleep cycle, whose wake time must be measured on the deployed URL."})
