# SwasthyaSetu AI — Adversarial Certification Report

## Certification Status

The deterministic backend, frontend build, accessibility, and UI resilience gates are complete and passing. The overall result remains **NOT CERTIFIED for full live-fire confidence** because Tier C provider validation was not executed: Groq and NVIDIA credentials exist in the project environment, but their dedicated test/sandbox provenance cannot be confirmed safely. The live-provider call and spend ceiling therefore remained zero. No live Gemini, Groq, NVIDIA, Google Maps, or DuckDuckGo provider call was made.

All nine bounded checklist conditions are complete. This means that deterministic certification, safety-invariant verification, and the browser torture gate are complete; it does not convert an unperformed live-provider check into evidence.

## Pre-Flight

| Item | Result |
|---|---|
| Repository instructions | No `AGENTS.md` file was present in the project tree. |
| Project baseline | Frontend uses React/Vite/TypeScript/Tailwind; backend uses FastAPI/Pydantic. Existing backend tests were initially absent apart from fixtures, so the deterministic suite was added. |
| Provider-key status | Gemini and Google Maps keys were unset. Groq and NVIDIA keys were non-empty, but values were withheld and provenance was unconfirmed. |
| Live-call policy | Zero live provider calls and zero provider spend until dedicated non-production credentials and an explicit safe ceiling are confirmed. |
| Iteration ceiling | 15 full-loop iterations; not reached. |
| Severity policy | Critical and High block certification. Medium remains a tracked residual risk; Low is non-blocking quality debt. |
| Git checkpoint | No `.git` working tree was found, so no checkpoint commit was possible. |

## Audit Findings

| ID | Phase | Severity | File(s) | Root Cause | Final Status |
|---|---|---|---|---|---|
| ADV-01 | Static / Tier A | High | `backend/app/services/precision_service.py` | `asyncio` was referenced without an import, causing source retrieval to silently degrade; timeout was 8 seconds rather than the required 3.5 seconds. | Fixed and tested. |
| ADV-02 | Static / build gate | High | `frontend/src/components/Header.tsx`, `PrecisionDisclaimer.tsx`, `SlideTabs.tsx`, `Triage.tsx` | Dead imports/state and a React 19 callback ref returning a value caused TypeScript failure. | Fixed; lint passes. |
| ADV-03 | UI accessibility | Medium | `frontend/src/components/SearchSelect.tsx` | Clickable `div` elements lacked combobox/listbox semantics, keyboard navigation, active-option state, and focus return; filtering recomputed on every render. | Fixed and tested. |
| ADV-04 | UI resilience | Medium | `frontend/src/components/MapView.tsx` | External tile failures had no user-visible fallback state. | Fixed with a typed `tileComponent` error path and accessible facility-list fallback notice. |
| ADV-05 | Multilingual safety | Medium | `backend/app/services/safety_layer.py`, `backend/tests/test_adversarial_live.py` | The deterministic backstop originally matched only English red-flag phrases despite project-owned Hindi/Bengali cardiac phrases existing in `v2_data`. | Improved for the exact existing Hindi/Bengali chest-pain phrases and tested. Other supported-language coverage still requires clinical review. |
| ADV-06 | Static / Framer Motion | Low | `frontend/src/components/SlideTabs.tsx` | Geometry is measured in effects and mouse handlers, which can cause extra renders. No leak or crash was observed. | Logged; not refactored under minimal-diff rule. |
| ADV-07 | Static / Framer Motion | Low | `frontend/src/components/Cursor3D.tsx` | Global pointer listeners and spring motion require lifecycle care. | Pass; every listener is removed in cleanup. |

## Fixes Applied

| ID | Fix Summary | Files Changed |
|---|---|---|
| FIX-01 | Imported `asyncio` and enforced the 3.5-second precision scraper timeout. | `backend/app/services/precision_service.py` |
| FIX-02 | Removed dead Header navigation code and unused Triage/PrecisionDisclaimer declarations; corrected the React 19 callback ref. | `frontend/src/components/Header.tsx`, `frontend/src/components/PrecisionDisclaimer.tsx`, `frontend/src/components/SlideTabs.tsx`, `frontend/src/pages/Triage.tsx` |
| FIX-03 | Added semantic SearchSelect combobox/listbox/option roles, 44px trigger, memoized filtering, active-option styling, ArrowUp/ArrowDown/Enter/Escape handling, disabled state, and focus return. | `frontend/src/components/SearchSelect.tsx` |
| FIX-04 | Added Pigeon Maps `tileComponent` error handling and an `aria-live` facility-list fallback notice. | `frontend/src/components/MapView.tsx` |
| FIX-05 | Added exact project-owned Hindi and Bengali chest-pain phrases to the deterministic emergency backstop and parameterized tests. | `backend/app/services/safety_layer.py`, `backend/tests/test_adversarial_live.py` |
| FIX-06 | Added deterministic adversarial tests for provider 429 fallback, timeout enforcement, payload poisoning, emergency override, vision escalation, curated pricing precedence, and localized red flags. | `backend/tests/test_adversarial_live.py` |

## Verification Results

- **Backend compilation:** Pass — `python -m compileall -q backend/app` exited 0.
- **Backend deterministic suite:** Pass — `pytest -q backend/tests` reported **8 passed**. Two FastAPI `on_event` deprecation warnings were observed; no test failure occurred.
- **Frontend type-check/lint:** Pass — `npm run lint` (`tsc --noEmit`) exited 0.
- **Frontend production build:** Pass — Vite transformed 486 modules and produced the single-file artifact at approximately 1,900.67 kB, gzip approximately 485.63 kB.
- **Tier A cascade simulation:** Pass — simulated Gemini and Groq 429 responses fell through to NVIDIA without a live request.
- **Tier A timeout simulation:** Pass — precision-source timeout was observed at exactly 3.5 seconds and degraded to an empty source list without raising.
- **Payload poisoning:** Pass — malformed, oversized, structurally invalid, and corrupted JSON returned 422 rather than 500 across the active POST endpoints.
- **Safety override:** Pass — chest pain plus sweating remained `emergency=true`, `level=4`, and a non-serious vision signal was marked as a blocked downgrade.
- **Vision escalation:** Pass — a simulated vision emergency signal escalated a benign text pathway to level 4.
- **Pricing provenance:** Pass — curated data returned `verified_official_data` and prevented scrape/LLM fallback access.
- **Localized red flags:** Pass for the existing Hindi `सीने में दर्द` and Bengali `বুকের ব্যথা` phrases; broader language coverage remains a clinical-review item.
- **SearchSelect torture:** Pass — 44px trigger; semantic combobox/listbox state; 100 rapid input events; ArrowDown+Enter selection; Escape/selection closure; focus returned to the combobox trigger.
- **Animation/control abuse:** Pass — 50 rapid control clicks left the React root mounted and route state coherent.
- **Slow 3G resilience:** Pass — `/facilities` remained mounted under throttled network conditions while the backend was offline.
- **Map tile fallback:** Pass — 21 synthetic tile error events produced `role="status"` text: “Map tiles are unavailable right now. Use the facility list or Get directions links below.” The React root remained mounted.
- **Console review:** Pass for application exceptions — no uncaught JavaScript exceptions. Expected headless software-WebGL warnings and intentional backend `ERR_CONNECTION_REFUSED` events were classified separately.
- **Final macro gate:** Pass twice consecutively after all changes. Each run included backend compilation, the full 8-test suite, frontend lint, frontend build, and the browser torture harness.
- **Breakpoint coverage:** The inherited QA matrix remains the authoritative responsive verification for 320, 375, 414, 768, 1024, 1440, and 2560px. The final UI torture pass additionally verified the 44px control and narrow-route stability. No new responsive regression was introduced by the final patches.

## Two-Pass Macro Evidence

| Run | Result | Backend | Frontend | Browser torture | Notes |
|---|---|---:|---:|---:|---|
| Final Run 1 | Pass | compileall + 8 passed | lint + build pass | Pass, including map fallback | No live provider calls. |
| Final Run 2 | Pass | compileall + 8 passed | lint + build pass | Pass, including map fallback | Consecutive clean run; no Critical/High findings. |

## Items Requiring Your Decision

| Decision | Why it matters | Current state |
|---|---|---|
| Confirm dedicated test/sandbox credentials for Groq and NVIDIA | Required before any Tier C live cascade call can be made safely. | Blocked; provenance unconfirmed and call ceiling is zero. |
| Set a live-call/token/spend ceiling | Prevents accidental provider spend during Tier C validation. | Required before live execution. |
| Approve multilingual clinical review of remaining red-flag phrases | The backstop currently has expanded exact Hindi/Bengali cardiac coverage, but the other supported UI languages need reviewed phrase fixtures rather than engineering guesses. | Open Medium risk. |
| Approve production map-tile provider and fallback policy | The client-side tile error fallback is now present, but provider uptime, attribution, and production fallback policy remain deployment decisions. | Open deployment decision. |
| Decide whether to replace deprecated FastAPI `on_event` startup hooks | Current warning is non-blocking, but a future FastAPI upgrade may require lifespan migration. | Open Low maintenance item. |

## Tier C Live Confidence Check

The check was **not run**. No provider latency, 429 behavior against real services, or provider spend is claimed. The reason is safety, not a test failure: the environment exposes non-empty Groq/NVIDIA key metadata but does not establish that those credentials are dedicated test keys. A user-approved follow-up with confirmed sandbox keys and a safe ceiling can run the live cascade once, record provider order/latency, and then repeat the two-pass macro gate.

## Residual Risk

The deterministic certification package is complete, but full bulletproof certification remains withheld until the Tier C credential and budget decision is resolved. Multilingual red-flag coverage beyond the exact Hindi/Bengali phrases added here needs clinical review and fixtures for every supported language. The map fallback is now user-visible and tested through synthetic tile failures, but the production tile provider and attribution policy still require deployment approval. These are Medium or Low residual risks; no Critical or High finding remains open.

## References

1. [AI Ethics Guardrails](docs/06_AI_ETHICS_GUARDRAILS_SwasthyaSetu_AI.md)
2. [Deterministic adversarial tests](backend/tests/test_adversarial_live.py)
3. [Adversarial progress log](progress.md)
4. `pasted_content_6.txt` — the user-provided adversarial testing brief attached to this task.
