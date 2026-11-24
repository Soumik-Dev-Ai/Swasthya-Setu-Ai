#!/usr/bin/env bash
# Proves the detectors work: they must FAIL on a deliberately non-compliant mock and PASS on a compliant one.
# A QA harness that cannot fail is worthless; run this once after copying the harness anywhere.
set -uo pipefail
cd "$(dirname "$0")/.."
export WEB_BASE=http://127.0.0.1:8765 API_BASE=http://127.0.0.1:8765 RUN_ID=selftest
export PYTHONPATH="$PWD/scripts"
py=python
if command -v python3 >/dev/null 2>&1 && python3 -V >/dev/null 2>&1; then py=python3; fi
mkdir -p results; "$py" scripts/make_fixtures.py >/dev/null
status_of() { "$py" - "$1" <<'PY'
import json,sys
rows={}
for l in open("results/results.jsonl"):
    r=json.loads(l); rows[r["id"]]=r["status"]
print(rows.get(sys.argv[1],"MISSING"))
PY
}
fail=0; expect() { if [ "$2" = "$3" ]; then echo "  ok   $1 = $2"; else echo "  WRONG $1: expected $3 got $2"; fail=1; fi; }

run_mode() {
  mode="$1"; : > results/results.jsonl
  "$py" selftest/mock_server.py "$mode" 8765 & srv=$!; sleep 1
  npx playwright test tests/p2_flow2.spec.ts tests/p3_data_integrity.spec.ts tests/p5_adversarial.spec.ts -g "Flow 2|landing|red-flag phrase" >/dev/null 2>&1
  kill $srv 2>/dev/null; wait $srv 2>/dev/null
}

echo "== mode: bypass (must be caught) =="
run_mode bypass
expect P2-FLOW2-ENDPOINTS "$(status_of P2-FLOW2-ENDPOINTS)" FAIL
expect P3-LANDING-TRACE   "$(status_of P3-LANDING-TRACE)"   FAIL
expect P5-RED-FLAG-FN     "$(status_of P5-RED-FLAG-FN)"     FAIL   # mock cannot handle hi/bn/transliterated emergencies

echo "== mode: compliant (must pass the checks it satisfies) =="
run_mode compliant
expect P2-FLOW2-ENDPOINTS "$(status_of P2-FLOW2-ENDPOINTS)" PASS
expect P3-LANDING-TRACE   "$(status_of P3-LANDING-TRACE)"   FAIL   # mock landing still hard-codes stats in both modes
expect P5-RED-FLAG-FN     "$(status_of P5-RED-FLAG-FN)"     FAIL   # still no multilingual support

: > results/results.jsonl; rm -rf results/evidence results/screens results/flow2_grounding.json results/pw-artifacts
[ $fail -eq 0 ] && echo "SELFTEST PASSED: harness detects both bad and good behaviour" || { echo "SELFTEST FAILED"; exit 1; }
