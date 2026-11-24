#!/usr/bin/env bash
# Ordered, gated QA run. Usage:
#   ./run_all.sh                 full run from Phase 0
#   FROM=P4 ./run_all.sh         resume at a phase (results.jsonl is kept when FROM is set)
#   ONLY=P2 ./run_all.sh         run a single phase
# Order is deliberate: cheap read-only checks first, mutating flows next, rate-limit/load LAST because they
# exhaust limiter windows and would corrupt every functional result that ran after them.
set -uo pipefail
cd "$(dirname "$0")"

[ -f .env.qa ] || { echo "Copy .env.qa.example to .env.qa and fill it in first."; exit 2; }
# Verbatim .env loader (bash `source` would mangle regexes like \b and spaces in selectors).
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|'#'*) continue ;; esac
  k="${line%%=*}"; v="${line#*=}"
  v="$(printf '%s' "$v" | sed -E 's/[[:space:]]+#.*$//; s/[[:space:]]+$//')"
  export "$k=$v"
done < .env.qa

export RUN_ID="${RUN_ID:-$(date +%Y%m%d%H%M%S)}"
export PYTHONPATH="$PWD/scripts:${PYTHONPATH:-}"
mkdir -p results/logs results/load results/recon
FROM="${FROM:-P0}"; ONLY="${ONLY:-}"
[ "$FROM" = "P0" ] && [ -z "$ONLY" ] && : > results/results.jsonl
[ -f results/results.jsonl ] || : > results/results.jsonl
order=(P0 P1 P2 P3 P4 P5 P6 P7 P8)
idx() { for i in "${!order[@]}"; do [ "${order[$i]}" = "$1" ] && echo "$i"; done; }
want() { if [ -n "$ONLY" ]; then [ "$ONLY" = "$1" ]; else [ "$(idx "$1")" -ge "$(idx "$FROM")" ]; fi; }
step() { # step <phase> <label> <cmd...> : never aborts the run; records rc
  local ph="$1" label="$2"; shift 2
  echo "--- [$ph] $label"
  "$@" 2>&1 | tee -a "results/logs/$ph.log"
  local rc="${PIPESTATUS[0]}"; echo "$ph|$label|rc=$rc" >> results/phase_rc.txt; return 0
}
pw() { npx playwright test "$@"; }
settle_limiter() { echo "waiting ${1:-65}s for rate-limit windows to drain"; sleep "${1:-65}"; }

if want P0; then
  echo "=== P0 PREFLIGHT (hard gate) ==="
  python3 scripts/make_fixtures.py >/dev/null
  python3 scripts/preflight.py 2>&1 | tee results/logs/P0.log
  [ "${PIPESTATUS[0]}" -eq 0 ] || { echo "Preflight failed: aborting. Nothing after this is meaningful."; exit 1; }
fi

if want P1; then
  echo "=== P1 RECON ==="
  step P1 "api routes"  python3 scripts/recon_api.py
  step P1 "ui inventory" pw tests/p1_recon.spec.ts
  if [ ! -f forms.json ]; then
    echo "NOTE: forms.json not found. Flows 5-7 will be BLOCKED until you create it from results/recon/ui_map.json (see forms.example.json)."
  fi
fi

if want P2; then
  echo "=== P2 FLOW 2 CONTRADICTION ==="
  step P2 "endpoint sequence + grounding" pw tests/p2_flow2.spec.ts
  step P2 "grounding exists in KB"        python3 scripts/verify_grounding.py
  step P2 "vector store + semantic retrieval" python3 scripts/rag_probe.py
fi

if want P3; then
  echo "=== P3 DATA INTEGRITY (read-only) ==="
  step P3 "cost/bed/landing/selectors" pw tests/p3_data_integrity.spec.ts
fi

if want P4; then
  echo "=== P4 E2E FLOWS ==="
  step P4 "your own suites (baseline)" python3 scripts/existing_suites.py
  step P4 "flows 1,3,5,6,7" pw tests/p4_flows.spec.ts
  step P4 "flow 8 monitor"  python3 scripts/flow8_monitor.py
fi

if want P5; then
  echo "=== P5 ADVERSARIAL ==="
  step P5 "phrase corpus, vision override, XSS, SQLi, oversize" pw tests/p5_adversarial.spec.ts
fi

if want P6; then
  echo "=== P6 CONCURRENCY CORRECTNESS ==="
  settle_limiter 65
  step P6 "refresh stampede" pw tests/p6_refresh_race.spec.ts
  step P6 "rate-limit exact thresholds" python3 scripts/rate_limit_probe.py
fi

if want P7; then
  echo "=== P7 LOAD ==="
  settle_limiter 65
  step P7 "cold start" python3 scripts/cold_start.py
  if command -v locust >/dev/null 2>&1; then
    U="${LOAD_USERS:-50}"; D="${LOAD_DURATION:-90s}"
    # Baseline: red-flag requests only, low concurrency (stays under the limiter).
    step P7 "solo red-flag baseline" locust -f load/locustfile.py --headless -u 3 -r 3 -t 30s --only-summary \
        --csv results/load/solo --tags redflag_only
    settle_limiter 65
    # Mixed: limiter state is whatever the backend is configured with. Served requests and 429s are recorded separately.
    step P7 "mixed load" locust -f load/locustfile.py --headless -u "$U" -r 10 -t "$D" --only-summary --csv results/load/mixed
    python3 load/analyze.py
  else
    python3 - <<'PY'
from common import record
record("P7-LOAD-NONBLOCK","Deterministic red-flag path stays fast under concurrent LLM-path load","BLOCKED",{"why":"locust not installed: pip install locust"})
PY
  fi
fi

if want P8; then
  echo "=== P8 REPORT ==="
  python3 scripts/report.py
  rc=$?
  echo "Exit code reflects FAIL count (0 = no failed checks). BLOCKED/PARTIAL still need attention: read results/REPORT.md"
  exit $rc
fi
