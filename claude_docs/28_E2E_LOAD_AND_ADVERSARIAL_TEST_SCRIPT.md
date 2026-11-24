# Document 28 — Ordered E2E, Load and Adversarial Test Run (v2: executable harness)

**What this is:** a phased, gated test run for your local AI agent, shipped with a working harness (`qa_harness/`) so the agent executes real code in a fixed order instead of improvising tests. Its job is to **independently verify or falsify** the blueprint's "8/8 E2E suites passed, 30/30 audit points cleared" claim.

**What was verified before you got this (honest status):**

| Part | Verification done |
|---|---|
| Flow 2 detector, landing-page number trace, red-flag phrase corpus, report builder, Locust files, rate-limit probe | **Executed** against a mock app, both in a deliberately non-compliant mode (must FAIL) and a compliant mode (must PASS). The self-test caught one real bug in my own landing-page check (a same-origin page counted as an "API response"); it is fixed. |
| Cost/as_of, bed staleness, selector dynamism, Flows 1, 3, 5, 6, 7, XSS/SQLi, refresh-race, cold start, Flow 8 | Written and compiled (`playwright test --list` parses all 19 tests; all Python compiles). **Not yet run against your real app**, because I can't see its DOM. Expect to adjust selectors in Phase 1. |

Do not treat the harness as proof of anything until it has run on your system. Its value is that it can fail.

---

## 0. Rules for the agent (read once, obey throughout)

1. Test the **running** system: real backend, real frontend, real DB (a QA/dev database, never production). No mocking the backend, no unit tests standing in for E2E.
2. Evidence, not summaries. Every check writes a row to `results/results.jsonl` plus `results/evidence/<id>.json` and a screenshot. "Works" is not a result.
3. **Four statuses only.** `PASS`, `FAIL`, `PARTIAL` (part of the claim shown), `BLOCKED` (could not run). BLOCKED and PARTIAL are never passes. Never convert one into the other to make the report look better.
4. Do not weaken a check to make it pass. If a check is wrong (bad selector, wrong endpoint), fix the **input** (`.env.qa`, `forms.json`, corpus) and say what you changed. If the system is wrong, report FAIL.
5. No silent retries. `retries: 0` in the Playwright config is deliberate.
6. The blueprint's 30/30 is the hypothesis under test, not the baseline.

## 1. Install the harness (5 minutes)

```
cp -r qa_harness <your-repo>/qa/ && cd <your-repo>/qa
npm install                      # @playwright/test (pinned to the version of your installed Playwright; adjust if different)
npx playwright install chromium  # skip if browsers already present
pip install requests psycopg2-binary locust
cp .env.qa.example .env.qa       # fill in; see §2 for what to confirm
bash selftest/run_selftest.sh    # MUST print "SELFTEST PASSED" before you trust anything else
```

If the self-test fails, **stop and fix the harness**. A harness that cannot detect a bad system is worse than no harness.

## 2. The run order and why it is this order

```
./run_all.sh        (FROM=P4 to resume, ONLY=P2 for one phase)
```

| Phase | What runs | Gate / dependency | Why here |
|---|---|---|---|
| **P0 Preflight** | tools, backend + frontend reachable, QA creds set, edge-model guard test (doc 24) | **Hard gate**: exits if the system isn't reachable | Everything after is meaningless otherwise |
| **P1 Recon** | `/openapi.json` route list, UI control inventory (`results/recon/`) | Produces the inputs P2–P6 depend on | Replaces guessing selectors/endpoints |
| **P2 Flow 2 contradiction** | real browser submits the blueprint's exact phrase; records every request in order; checks `grounding_reference`; verifies the reference exists in the KB | Result decides how to read every triage check after it | The single highest-value question: is the Reasoning Engine actually in the text path? |
| **P3 Data integrity** (read-only) | cost latency / `as_of` / no external host; bed "as of" label rendered; landing numbers traced to API; selectors fetched not hard-coded | none | Cheap, no state changes |
| **P4 E2E flows** | Flow 1 emergency, 3 vision (ok + provider outage), 5 ASHA offline sync, 6 referral states, 7 follow-up, 8 source monitor | needs `forms.json` for 5–7 | Mutates data, so after read-only checks |
| **P5 Adversarial** | full phrase corpus through the real UI, vision-override, XSS, SQLi, oversize | none | Heavy traffic, so before limiter tests |
| **P6 Concurrency correctness** | refresh-stampede count; exact rate-limit thresholds (200/min, 10/min) | waits 65s first | Probes the limiter, so it must come after functional runs |
| **P7 Load** | cold start; solo red-flag baseline; mixed load; compare | waits 65s first | Last: it exhausts limiter windows and would corrupt every earlier result if run earlier |
| **P8 Report** | `results/REPORT.md`, `summary.json`, blueprint reconciliation | `claim_map.json` | The honest tally |

Exit code is non-zero if any check FAILed. A zero exit with BLOCKED rows is **not** a clean bill of health.

## 3. Step-by-step instructions (do these in order)

### Step 1 — Environment (`.env.qa`)
Fill in URLs, the QA admin and an **already-approved** ASHA credential, and the optional extras. Each blank extra leaves one check BLOCKED, so fill what you can:

| Variable | Unlocks |
|---|---|
| `API_BASE_DEGRADED` | Flow 3b. Provider calls are made by the **backend**, so they cannot be blocked from the browser (the v1 instruction to block provider domains at the browser was wrong). Start a **second backend instance with invalid Gemini/Groq/NVIDIA keys** and point this at it; the harness reroutes the browser's API calls to it. |
| `BACKEND_GUARD_TEST_CMD` | The doc 24 check that the fine-tuned model refuses to load under `DEPLOYMENT_TARGET=cloud_production` |
| `BACKEND_START_CMD` | Cold-start measurement |
| `MONITOR_TRIGGER_CMD`, `PUBLISHED_TABLE`, `DATABASE_URL` | Flow 8 |
| `RATE_HEAVY_PATH` | The 10/min threshold probe |

Do not use the documented `admin/admin123`, `asha1/asha123` pair. If those are the only accounts, log "weak seed credentials still present" as a finding.

### Step 2 — Recon (P1), then fix the inputs
Run `ONLY=P1 ./run_all.sh`. Read `results/recon/api_routes.json` and `ui_map.json`, then:
1. Confirm or correct `RE_INTENT / RE_REASON / RE_ANALYZE`, `API_*_PATH`, `ROUTE_*`, `SEL_*` in `.env.qa`.
2. Create `forms.json` from `forms.example.json` (register ASHA, create patient, create referral). `{{mark}}` must appear in a patient/referral name field: it is how duplicate records are detected.
3. Pick `ROUTE_REFRESH_RACE`: an authenticated page that fires 3+ API calls on mount. The refresh test reports BLOCKED, not PASS, if it can't reject at least 3 concurrent requests.
4. **Merge the full adversarial phrase set from docs 09 §4 and 12 into `corpus/adversarial_phrases.json`** (the shipped file is a 20-case seed, not the real corpus). Keep each case's expected outcome from those docs; use `review` for genuinely ambiguous negation/hedging cases.
5. Create `claim_map.json` from `claim_map.example.json`: list **every one** of the blueprint's 30 audit points and 8 suites, each mapped to the check ids that would prove it. A claim with no mapped check can never count as confirmed, and that is intentional.

### Step 3 — Run the order
`./run_all.sh`, then read `results/REPORT.md`. Fix the harness inputs for any BLOCKED row that is BLOCKED because of harness misconfiguration, and re-run just that phase (`ONLY=P3 ./run_all.sh`).

### Step 4 — Upgrade the PARTIAL checks that are partial by design
These are honest placeholders the agent must finish, using knowledge of the real schema:
- **P3-PMJAY-ZERO**: repeat the cost request with a PM-JAY-eligible selection and assert patient cost = 0 for an in-database procedure.
- **P5-VISION-OVERRIDE**: PARTIAL means L4 held but the vision-downgrade path wasn't exercised. Stub the QA backend's vision provider to return `non_serious`, re-run, and require the `vision_downgrade_blocked` indicator to be **visible in the UI**.
- **P4-F8-MONITOR**: seed one ambiguous fixture in the QA DB (two same-day documents with contradictory supersession served from a local HTTP server and registered as a watched source), trigger the monitor, and assert that row ends in `needs_manual_confirmation` and the published-table checksum is unchanged.
- **P5-OVERSIZE**: PARTIAL means a 200KB body was accepted; confirm a maximum input length exists.

### Step 5 — Report
`results/REPORT.md` must contain, per phase, status plus evidence pointers, and a **blueprint reconciliation** block:

```
Blueprint claims 30/30 cleared.
Independently confirmed: X   Contradicted: Y   Not confirmed (BLOCKED/PARTIAL/unmapped): Z
```

State contradictions plainly. If P2-FLOW2-ENDPOINTS is FAIL, say that doc 27 Priority 1 (triage bypassing the Reasoning Engine) is **reopened**, not that a new issue was found.

## 4. What each check proves, and what it cannot

| Check | Proves | Does not prove |
|---|---|---|
| P2-FLOW2-ENDPOINTS | which endpoints the browser actually called, in order; whether a non-empty `grounding_reference` came back | that the answer is clinically correct |
| P2-FLOW2-GROUNDING-REAL | the reference string exists in the KB tables (searched by text match; adjust if refs are IDs) | that the retrieved chunk supports the claim made |
| P3-COST-LATENCY / NOEXTERNAL | no live external call and DB-like latency on one request | that every procedure is covered |
| P3-LANDING-TRACE | every visible number ≥10 appears in a real fetch/XHR response or the justified allowlist | that the backend's number is itself correct |
| P5-RED-FLAG-FN | zero missed emergencies **within the corpus you supply**, through the full UI | zero misses in the wild; the corpus size bounds the claim |
| P6-REFRESH-RACE | the app's own interceptor's exact refresh-call count under simulated expiry | behaviour under a real clock-based expiry (see note below) |
| P7-COLDSTART | max/median of N local restarts | a p95 (N=5 can't give one), nor the Render free-tier sleep wake time: measure that on the deployed URL |
| P7-LOAD-NONBLOCK | red-flag p95 under mixed load vs solo baseline (429s recorded separately so they don't flatter the numbers) | capacity limits; run once with the limiter off (`BACKEND_START_CMD_NOLIMIT`) for that |

Note on P6-REFRESH-RACE: it simulates expiry by rejecting authenticated calls with 401 until a refresh response has genuinely returned. It exercises the real client logic, but if you can mint a truly expired JWT in the QA environment, add that as a second confirmation.

## 5. Stop conditions (the agent halts and reports instead of continuing)

- P0 fails: system unreachable, nothing after it is valid.
- The self-test fails: the harness is broken.
- The agent is about to edit application code: this run is testing, not fixing. File findings; doc 27 and the fix prompts are where fixes happen.
- A check can only be made to pass by loosening it: report it BLOCKED or FAIL.

## 6. File map

```
qa_harness/
  run_all.sh                 ordered, gated orchestrator (FROM= / ONLY=)
  .env.qa.example            every assumption, overridable
  forms.example.json         UI form specs (copy -> forms.json after recon)
  claim_map.example.json     blueprint-claim -> check-id map (copy -> claim_map.json)
  playwright.config.ts       1 worker, 0 retries
  lib/                       config, evidence recorder, network capture, UI helpers
  tests/p1..p6_*.spec.ts     Playwright phases
  scripts/                   preflight, recon_api, verify_grounding, rate_limit_probe,
                             cold_start, flow8_monitor, make_fixtures, report
  load/                      locustfile.py (separate stats for red-flag / ambiguous / 429), analyze.py
  corpus/                    adversarial_phrases.json (SEED: merge docs 09/12), incidental_numbers.json
  selftest/                  mock app + run_selftest.sh
```

## 7. Paste-ready prompt for your agent

```
You are the QA engineer for SwasthyaSetu AI. Your task is to independently test, not fix, the system and report
whether the blueprint's "30/30 audit points cleared, 8/8 E2E suites passed" is true.

Work in <repo>/qa/ (the qa_harness folder). Read 28_E2E_LOAD_AND_ADVERSARIAL_TEST_SCRIPT.md (this document; copy it next to the harness)
fully before acting and obey its Section 0 rules and Section 5 stop conditions.

Execute strictly in this order, and do not skip or reorder:
1. Install per section 1; run `bash selftest/run_selftest.sh`; stop if it does not print SELFTEST PASSED.
2. Fill .env.qa (ask me only for credentials and optional extras you cannot discover). Never use admin123/asha123.
3. Run P0, then P1. From results/recon/*, correct .env.qa, create forms.json, merge the full adversarial corpus from
   docs 09 and 12 into corpus/adversarial_phrases.json, and create claim_map.json covering all 30 audit points + 8 suites.
4. Run P2 first and report its verdict on its own before anything else: which endpoints the text-triage path called,
   in what order, and whether a real, KB-verified grounding_reference came back.
5. Run P3 -> P4 -> P5 -> P6 -> P7 -> P8 via ./run_all.sh (use FROM=/ONLY= to resume). Fix harness inputs for any
   check that is BLOCKED because of misconfiguration; never loosen a check to turn FAIL/PARTIAL into PASS.
6. Complete the four by-design PARTIAL checks in section 3 step 4.
7. Deliver results/REPORT.md, results/summary.json and the evidence folder. The report must end with the
   confirmed / contradicted / not-confirmed counts against the blueprint's 30 claims, with every contradiction stated plainly.
```

---

## Addendum (v2.1): changes after the docs-vs-codebase alignment audit

The audit report (your codebase vs docs 00-27) was read critically. It is the same kind of evidence as "30/30 cleared": a self-assessment, not an independent test, so it adjusts what the harness checks but confirms nothing by itself.

| Audit statement | Effect on the harness |
|---|---|
| Frontend calls `POST /api/triage/analyze` with `{ symptoms, flags, reasoning: true }`; reasoning is embedded in that one response; `/v3/intent` and `/v3/reason` are kept for other consumers | The Flow 2 contradiction is **likely resolved in the blueprint's favour**, but only P2 can prove it. P2 now treats a lone `/triage/analyze` carrying a grounded `reasoning` payload as a valid PASS and records the request body and provider/model fields. Load, cold-start and rag probes now send `symptoms` plus `flags`/`reasoning` (v2 sent `text`, which would have produced 422s and meaningless latency). Configurable via `TRIAGE_TEXT_FIELD`, `TRIAGE_EXTRA_JSON`. |
| Vector store is an in-process JSON/hash-embedding retriever, not pgvector+HNSW | This **departs from the locked decision** (docs 14/22; architecture memory). The audit's reason (free tier cost) does not hold, since Neon's free tier includes pgvector. New checks: **P2-RAG-VECTORSTORE** (pgvector + ANN index present?) and **P2-RAG-SEMANTIC** (do paraphrases with no shared keywords still retrieve grounded answers? Hash embeddings match tokens, not meaning, so this is the real risk). Decide deliberately: migrate, or update the docs and accept the limits. |
| "100% compliant and tested", `e2e_verify.py` proves live flows | New **P4-OWN-E2E / P4-OWN-UNIT** run your own suites as a baseline. The signal is *disagreement*: own suite green but an independent check red. |
| Landing page shows `5 lakh` and `384` as constants | These are static documented facts, not API data. `384` is allowlisted in `corpus/incidental_numbers.json` with a reason; the reason says to verify it against the NLEM source. |
| Project lives at `C:\Users\user\projects\SwasthaSetu Ai` with `frontend 2.0` | **Windows**: use `run_all.ps1` (same phases/gates). It was **not executed** (no PowerShell in the build sandbox): treat its first run as a test of the script. `cold_start.py` is now cross-platform. Quote paths with spaces in `.env.qa` commands. |
| LLM cascade named as Gemini 1.5 Flash, Groq Llama-3.2, NVIDIA NIM | Model names age out. P2 records provider/model fields from responses; confirm those models still exist and that the cascade's fallback actually fires (Flow 3b covers the outage case). |

Also read: the audit calls P2 cuts (FHIR, SMS) "documented and justified". That is consistent with doc 08 and not tested here.
