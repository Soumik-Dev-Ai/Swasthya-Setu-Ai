#!/usr/bin/env python3
"""Phase 0 — preflight. Hard gate: exits non-zero if the system under test is not reachable,
because every later result would be meaningless. Also runs the cloud-guard test (doc 24)."""
import shutil, subprocess, sys
import requests
from common import API, env, record

WEB = env("WEB_BASE", "http://localhost:5173")
fatal = []


def check(name, ok, detail=""):
    print(("  ok   " if ok else "  FAIL ") + name + (f" — {detail}" if detail else ""))
    if not ok:
        fatal.append(name)


print("Phase 0 — preflight")
for tool in ("node", "npx"):
    check(f"tool: {tool}", shutil.which(tool) is not None)
check("tool: python", bool(shutil.which("python") or shutil.which("python3")))

for name, url in (("backend", API + env("HEALTH_PATH", "/health")), ("frontend", WEB)):
    try:
        r = requests.get(url, timeout=8)
        check(f"{name} reachable", r.status_code < 500, f"{url} -> {r.status_code}")
    except Exception as e:  # noqa
        check(f"{name} reachable", False, f"{url}: {e}")

check("QA_ASHA_USER/PASS set", bool(env("QA_ASHA_USER") and env("QA_ASHA_PASS")), "needed for Flows 5-7 and the refresh-race test")
check("QA_ADMIN_USER/PASS set", bool(env("QA_ADMIN_USER") and env("QA_ADMIN_PASS")), "needed to approve the new ASHA in Flow 5")
weak = {("admin", "admin123"), ("asha1", "asha123")}
if (env("QA_ADMIN_USER"), env("QA_ADMIN_PASS")) in weak or (env("QA_ASHA_USER"), env("QA_ASHA_PASS")) in weak:
    print("  note: QA credentials are the documented weak seed credentials (doc 27 item 11): log this as a finding, do not use them in a shared environment")

# Edge-model guard (doc 24): the backend must refuse to load the fine-tuned model when DEPLOYMENT_TARGET=cloud_production.
cmd = env("BACKEND_GUARD_TEST_CMD")
if cmd:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=300)
    record("P0-EDGE-GUARD", "Backend refuses to load the fine-tuned model when DEPLOYMENT_TARGET=cloud_production", "PASS" if r.returncode == 0 else "FAIL",
           {"cmd": cmd, "rc": r.returncode, "tail": (r.stdout + r.stderr)[-800:]})
else:
    record("P0-EDGE-GUARD", "Backend refuses to load the fine-tuned model when DEPLOYMENT_TARGET=cloud_production", "BLOCKED",
           {"why": "BACKEND_GUARD_TEST_CMD not set in .env.qa (e.g. 'cd ../backend && pytest tests/test_edge_model_guard.py -q')"})

if fatal:
    print("\nPREFLIGHT FAILED: fix the above before continuing:", ", ".join(fatal))
    sys.exit(1)
print("Preflight OK")
