# SwasthyaSetu AI — Deployment Certification

## Executive Decision

**Deterministic and isolated E2E scope: CERTIFIED GREEN. Immediate cloud deployment: NOT CLEARED.**

The final backend, frontend build, accessibility, resilience, and browser torture gates pass. Two complete punishment-loop runs finished green after the final fixes, with no open Critical or High defects. Immediate cloud deployment is not cleared because production-provider behavior, live cascade latency, live spend, and production rate-limit behavior were intentionally not exercised: the available Groq/NVIDIA credentials could not be confirmed as dedicated sandbox credentials, so the live-call ceiling remained zero. This is a deliberate safety boundary, not a test failure.

The requirement for literal zero latency or zero lag is not independently verifiable. The executed suite instead verified no freezes, uncaught application exceptions, route crashes, state desynchronization, or mobile overflow under the defined torture conditions.

## Scope and Safety Limits

| Item | Decision |
|---|---|
| Backend | FastAPI/Pydantic application and active v2/v3 routes. |
| Frontend | React/Vite single-file production build and active routes. |
| Live providers | No Gemini, Groq, NVIDIA, Google Maps, or DuckDuckGo live requests. |
| Provider keys | Gemini and Google Maps were unset. Groq and NVIDIA were non-empty but provenance was unconfirmed; values were never printed. |
| Live budget | Zero calls and zero spend until dedicated non-production credentials and a safe token/spend ceiling are confirmed. |
| Browser runner | Playwright was not installed. No undeclared project dependency was added; Chromium/CDP supplied an equivalent deterministic browser harness and this limitation is disclosed. |
| Iteration limit | 15 full-loop iterations; not reached. |
| Git checkpoint | No `.git` working tree was present, so no checkpoint commit was possible. |

## Audit Findings

| ID | Severity | Area | Finding and Root Cause | Final Status |
|---|---|---|---|---|
| ADV7-01 | High | LLM cascade | Pricing cascade attempts used a 12-second provider timeout, exceeding the required one-second failover bound. | Fixed to 1.0 second and covered by timeout-to-NVIDIA test. |
| ADV7-02 | High | Rate limiting / API contract | SlowAPI had no registered `RateLimitExceeded` handler, and `include_pricing=false` returned `price=null` while `FacilityAdvancedOut.price` was non-nullable. The first abuse run exposed a real FastAPI `ResponseValidationError`. | Fixed with the official 429 handler and nullable response field; suite restarted from test 1 and passed. |
| ADV7-03 | Medium | Input validation | Identifier fields accepted arbitrary strings, so SQL-like values were not rejected at the Pydantic boundary. | Fixed with a constrained `SafeId` type allowing valid dotted scheme IDs and rejecting SQL punctuation/oversized identifiers. |
| ADV7-04 | Medium | Mobile UX | The 375px probe measured the Facilities search input at 14px, creating an iOS auto-zoom risk. | Fixed with an explicit mobile `input.field` 16px rule; final probe measured 16px. |
| ADV7-05 | Medium | Map resilience | External map tile failures previously had no independently visible fallback. | Fixed in the prior hardening pass with a typed tile error path and accessible fallback notice; final blackout checks passed at desktop and iPhone SE widths. |
| ADV7-06 | Low | Browser tooling | Playwright is not installed in the repository. | No project dependency was added. Equivalent Chromium/CDP evidence was captured and the limitation is recorded. |
| ADV7-07 | Low | Framework maintenance | FastAPI emits two `on_event` deprecation warnings during tests. | Non-blocking; lifespan migration remains maintenance work. |

## Fixes Applied

| ID | Fix Summary | Files Changed |
|---|---|---|
| FIX7-01 | Reduced each pricing cascade provider timeout from 12 seconds to 1 second. | `backend/app/services/pricing_service.py` |
| FIX7-02 | Registered SlowAPI’s `RateLimitExceeded` handler so abuse receives HTTP 429. | `backend/app/main.py` |
| FIX7-03 | Made advanced-search `price` nullable when pricing is disabled, matching the frontend contract. | `backend/app/schemas/v2.py` |
| FIX7-04 | Added constrained `SafeId` validation for city, hospital, disease, scheme, state, category, work, need, and network identifiers. | `backend/app/schemas/v2.py` |
| FIX7-05 | Added explicit 16px mobile font enforcement for `.field` inputs to prevent iOS auto-zoom. | `frontend/src/index.css` |
| FIX7-06 | Added regression coverage for 1-second timeout fallback, rate-limit abuse, SQL-like payloads, and free-text symptom handling. | `backend/tests/test_adversarial_live.py` |

## Backend Integration and API Edge Cases

| Test | Expected | Result |
|---|---|---|
| Gemini timeout at one second | Provider attempt is abandoned and cascade continues to NVIDIA. | Pass — mocked timeout fell through to NVIDIA with structured output. |
| Gemini/Groq simulated 429 | Cascade continues in order without crashing. | Pass — mocked calls followed Gemini → Groq → NVIDIA. |
| DuckDuckGo network blackout | Strict 3.5-second timeout and graceful empty-source result. | Pass — timeout observed at exactly 3.5 seconds. |
| Missing, oversized, malformed, and corrupted JSON | HTTP 422, never internal HTTP 500. | Pass across active POST endpoints. |
| SQL-like identifiers | HTTP 422 at Pydantic boundary. | Pass across emergency-route, cost, insurance, schemes, facilities, and advanced-search cases. |
| SQL-like symptom text | Remains free text and does not produce an internal error. | Pass — triage returned HTTP 200 under mocked precision lookup. |
| Advanced-search abuse | Request beyond 10/minute per IP is blocked with HTTP 429. | Pass — 12-request burst produced 429 and no 500. |
| Curated pricing precedence | Curated amount/source wins and scrape/LLM are not invoked. | Pass — `verified_official_data` returned with confidence 95. |
| Emergency override | Non-serious model signal cannot downgrade a red flag. | Pass — chest-pain cases stayed level 4 emergency. |

The final backend command was `python -m compileall -q backend/app` followed by `python -m pytest -q backend/tests`. The result was **12 passed**, with two known FastAPI deprecation warnings and no test failures.

## Frontend E2E and Torture Results

The equivalent Chromium/CDP harness executed the browser cases because Playwright was unavailable and adding an undeclared project dependency was outside scope. The desktop torture run passed the following checks: the SearchSelect trigger measured 45px, exposed combobox/listbox semantics, survived 100 rapid input events, selected and closed through ArrowDown+Enter, returned focus to the trigger, survived 50 rapid control/animation clicks, preserved the React root during Slow 3G navigation to `/facilities`, and exposed the map fallback after 21 synthetic tile errors. No uncaught JavaScript exception occurred. The two application-level network errors were the expected backend connection refusals from the intentionally offline browser setup.

The route-churn probe mounted and unmounted the active `/triage`, `/asha`, `/facilities`, `/cost`, `/insurance`, and `/home` routes through **24 cycles**. It finished at `/home` with `#root` mounted and `applicationExceptions=0`.

## iPhone SE Verification

The final mobile probe used a 375x667 emulated viewport and passed the following objective checks: `scrollWidth=375`, `clientWidth=375`, and no horizontal overflow; the search input computed to 16px and the select to 16px; the active MapView wrapper measured 400px high and 341px wide; seven synthetic map-tile failures produced the accessible fallback message, “Map tiles are unavailable right now. Use the facility list or Get directions links below.”; and the React root remained mounted. The mobile probe recorded two expected offline backend network errors but no uncaught JavaScript exception.

## Frontend Build Gate

`npm run lint` (`tsc --noEmit`) passed. `npm run build` passed and transformed 486 modules into the single-file production artifact at approximately 1,900.75 kB, gzip approximately 485.64 kB. The build was repeated in both final punishment-loop passes.

## Punishment-Loop Record

| Run | Sequence | Result |
|---|---|---|
| Targeted restart | Backend suite after the first rate-limit abuse attempt | Failed as expected during diagnosis: `ResponseValidationError` caused by nullable pricing mismatch. Patched response model and restarted from test 1. |
| Final full pass 1 | compileall → 12 pytest tests → frontend lint → frontend build → desktop UI torture → iPhone SE probe | Pass. |
| Final full pass 2 | compileall → 12 pytest tests → frontend lint → frontend build → desktop UI torture → iPhone SE probe | Pass. |

The final two complete passes were consecutive and green. No Critical or High finding remains open.

## Verification Results

- **Backend compile:** Pass.
- **Backend tests:** Pass, 12 passed and 0 failed.
- **Frontend type-check:** Pass.
- **Frontend production build:** Pass.
- **Mocked 1-second LLM timeout/fallback:** Pass.
- **Mocked 429 cascade degradation:** Pass.
- **3.5-second scraper blackout:** Pass.
- **Pydantic malformed/oversized/SQL-like payload rejection:** Pass.
- **Rate-limit abuse:** Pass with HTTP 429 and no HTTP 500.
- **SearchSelect 100-input stress:** Pass.
- **Map tile blackout:** Pass with visible fallback and mounted UI.
- **Animation/route churn:** Pass, 24 cycles and zero application exceptions.
- **iPhone SE 375x667:** Pass, no overflow, 16px controls, 400px map, fallback visible.
- **Final two-pass punishment loop:** Pass.
- **Live-provider Tier C:** Not run; credential provenance and live budget were not confirmed.

## Items Requiring Your Decision

| Decision | Required Input |
|---|---|
| Live-provider validation | Confirm Groq/NVIDIA credentials are dedicated non-production test keys. |
| Safe live budget | Provide the maximum permitted calls/tokens/spend for the Tier C cascade check. |
| Cloud deployment | Approve whether deployment may proceed with deterministic certification only, or require Tier C completion first. This report recommends requiring Tier C before production claims. |
| Multilingual safety | Approve clinical review and fixture coverage for red-flag phrases in all remaining supported languages beyond the exact Hindi/Bengali cardiac phrases covered here. |
| Map provider | Approve production tile provider, attribution, quota, and fallback policy. |
| FastAPI maintenance | Decide when to migrate deprecated `on_event` hooks to lifespan handlers. |

## Residual Risk and Deployment Recommendation

The deterministic product surface is green and suitable for continued staging or internal review. It is **not cleared for immediate cloud production deployment** under a claim of complete live-fire certification until dedicated sandbox credentials and a safe Tier C budget are confirmed. Even after Tier C, production deployment should retain the user-visible map fallback, rate limiting, curated-pricing precedence, emergency rule authority, and reviewed multilingual safety fixtures.

## References

1. [AI Ethics Guardrails](docs/06_AI_ETHICS_GUARDRAILS_SwasthyaSetu_AI.md)
2. [Backend adversarial test suite](backend/tests/test_adversarial_live.py)
3. [Progress log](progress.md)
4. [Pasted content 7 brief](pasted_content_7.txt — attached to the task session)
5. [Earlier hardening report](bulletproof_certification.md)
