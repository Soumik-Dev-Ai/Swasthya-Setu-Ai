#!/usr/bin/env python3
"""Run the project's OWN suites as a baseline. Their result is the developer's evidence, not independent evidence:
the point is to detect disagreement (own suite green, independent harness red)."""
import subprocess
from common import env, record
for id, var, claim in (("P4-OWN-E2E", "E2E_VERIFY_CMD", "Project's e2e_verify.py passes"), ("P4-OWN-UNIT", "BACKEND_TEST_CMD", "Project's backend test suite passes")):
    cmd = env(var)
    if not cmd: record(id, claim, "BLOCKED", {"why": f"{var} not set"}); continue
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=1800)
    record(id, claim, "PASS" if r.returncode == 0 else "FAIL", {"cmd": cmd, "rc": r.returncode, "tail": (r.stdout + r.stderr)[-1200:], "caveat": "self-reported; compare with independent P2-P6 results"})
