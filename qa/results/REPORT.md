# SwasthyaSetu QA Report

Checks executed: **36**  |  PASS 31  |  FAIL 0  |  PARTIAL 3  |  BLOCKED 2

BLOCKED and PARTIAL are **not** passes. BLOCKED = the check could not run; PARTIAL = only part of the claim was demonstrated.

## Flow 2 contradiction (resolved first)
**PASS** — Consolidated gateway: /triage/analyze alone carried the reasoning (blueprint design). Reasoning/analyze endpoint called and a non-empty grounding_reference returned. Chunk existence is verified by scripts/verify_grounding.py.

Observed request sequence:
- `POST /api/triage/analyze -> 200 (3732ms)`

## Failures (fix list)
None.

## P0
| Check | Status | Claim |
|---|---|---|
| P0-EDGE-GUARD | PASS | Backend refuses to load the fine-tuned model when DEPLOYMENT_TARGET=cloud_production |

## P2
| Check | Status | Claim |
|---|---|---|
| P2-FLOW2-ENDPOINTS | PASS | Text triage runs through the Reasoning Engine and returns a grounded result (resolves integration-report vs blueprint contradiction) |
| P2-FLOW2-GROUNDING-REAL | PASS | grounding_reference returned by triage traces to a real chunk in the knowledge base |
| P2-RAG-SEMANTIC | PASS | Retrieval grounds paraphrased symptoms that share no keywords with the guidelines |
| P2-RAG-VECTORSTORE | PASS | Knowledge base uses pgvector with an ANN index (locked decision, docs 14/22) |

## P3
| Check | Status | Claim |
|---|---|---|
| P3-BED-STALENESS | PASS | Bed/ICU capacity is never implied as live; a staleness label is visible on screen |
| P3-COST-ASOF | PASS | Cost response carries a freshness/as_of field |
| P3-COST-LATENCY | PASS | Cost answer is a DB lookup (fast, no live compute) |
| P3-COST-NOEXTERNAL | PASS | No external/third-party request at query time on the cost page |
| P3-LANDING-TRACE | PASS | Landing-page statistics come from backend data, not frontend mock data |
| P3-PMJAY-ZERO | PARTIAL | PM-JAY eligible in-database procedure shows ₹0 patient cost |
| P3-SELECTOR-CITY | PASS | City list is served by the backend (any-city expansion) |
| P3-SELECTOR-DISEASE | PASS | Disease/procedure list is served by the backend (autonomous-refresh architecture) |

## P4
| Check | Status | Claim |
|---|---|---|
| P4-F1-EMERGENCY | PASS | Red-flag text → L4 in <1s with 108 call button and nearest-facility directions link |
| P4-F3-VISION-DEGRADED | BLOCKED | Provider outage degrades to a safe "uncertain" result |
| P4-F3-VISION-OK | PASS | Image + text triage renders a result |
| P4-F5-ADMIN-APPROVE | PASS | Admin can approve the pending ASHA (API shortcut) |
| P4-F5-NO-DUP | PASS | Sync after reconnect creates no duplicate record |
| P4-F5-OFFLINE-SYNC | PASS | Records created in true offline mode queue locally and sync exactly once on reconnect |
| P4-F5-PENDING-LOGIN | PASS | Newly registered ASHA cannot log in until an admin approves |
| P4-F6-FOLLOWUP | PASS | Discharge creates a follow-up worklist entry |
| P4-F6-STATES | PASS | Referral state machine pending→in_transit→arrived→admitted→discharged works through the UI |
| P4-F7-FOLLOWUP-DONE | PASS | Completed follow-up leaves the worklist and appears in patient timeline |
| P4-F8-MONITOR | PARTIAL | Source monitor routes ambiguous changes to needs_manual_confirmation and never silently publishes |
| P4-OWN-E2E | PASS | Project's e2e_verify.py passes |
| P4-OWN-UNIT | PASS | Project's backend test suite passes |

## P5
| Check | Status | Claim |
|---|---|---|
| P5-OVERSIZE | PASS | Oversized payload is rejected gracefully (4xx) with no crash/unhandled page error |
| P5-RED-FLAG-FN | PASS | Every true-emergency phrase (all languages/variants) yields L4 end-to-end in the UI; zero false negatives |
| P5-SQLI | PASS | SQLi-shaped strings are handled without server errors |
| P5-VISION-OVERRIDE | PARTIAL | Red-flag text cannot be downgraded by a benign vision result; override indicator shown |
| P5-XSS | PASS | XSS payloads in symptom text are escaped, never executed |

## P6
| Check | Status | Claim |
|---|---|---|
| P6-RATELIMIT-DEFAULT | PASS | Limiter returns 429 at request #201 within one minute for /health |
| P6-RATELIMIT-HEAVY | PASS | Limiter returns 429 at request #11 within one minute for /api/facilities/advanced-search |
| P6-REFRESH-RACE | PASS | Concurrent expired-token requests trigger exactly one /auth/refresh (no refresh stampede) |

## P7
| Check | Status | Claim |
|---|---|---|
| P7-COLDSTART | BLOCKED | First request after a cold start completes in < 3.0s |
| P7-LOAD-NONBLOCK | PASS | Deterministic red-flag path stays fast under concurrent LLM-path load (not serialized behind it) |

## Blueprint reconciliation
Blueprint claims **30/30 cleared**.
- Independently confirmed (all mapped checks PASS): **25**
- Contradicted (at least one mapped check FAIL): **0**
- Not confirmed (BLOCKED / PARTIAL / no mapped check): **5**

### Not confirmed
- #6: Safety-override audit logging captures vision downgrade blocks  → checks: P5-VISION-OVERRIDE
- #15: Vision LLM cascade with graceful degradation to uncertain  → checks: P4-F3-VISION-OK, P4-F3-VISION-DEGRADED
- #21: Cold start backend boot within acceptable latency target  → checks: P7-COLDSTART
- #25: PM-JAY eligible procedures show zero patient out-of-pocket cost  → checks: P3-PMJAY-ZERO
- #26: Automated ETL and source registry monitoring verifies source integrity  → checks: P4-F8-MONITOR
