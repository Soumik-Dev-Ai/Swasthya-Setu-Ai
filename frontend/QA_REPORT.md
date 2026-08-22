# SwasthyaSetu AI — QA Audit Report

## Audit Findings

| ID | Phase | Severity | File(s) | Root Cause |
|---|---|---|---|---|
| QA-01 | 0/1 | High | `src/lib/engine.ts`, `backend/app/core/config.py` | The frontend API base was hard-coded to localhost, while backend CORS allowed only local Vite origins. |
| QA-02 | 0/1 | High | `backend/app/api/routers/v2_engine.py`, `backend/app/schemas/v2.py` | Active v2 routes returned raw dictionaries/lists without explicit `response_model` enforcement. |
| QA-03 | 0/1 | High | `src/pages/Triage.tsx`, `Cost.tsx`, `Insurance.tsx`, `Facilities.tsx`, `Asha.tsx` | Several asynchronous failures were swallowed, leaving blank, stale, or generic empty states without logging or visible feedback. |
| QA-04 | 0/1 | High | `src/pages/Triage.tsx`, `Cost.tsx`, `Insurance.tsx` | User-triggered asynchronous actions did not consistently expose loading state, disable controls, or reset loading in `finally`. |
| QA-05 | 0/2 | Medium | `src/lib/engine.ts`, affected page files | Fetch wrappers did not accept abort signals, allowing stale requests and possible unmounted updates. |
| QA-06 | 0/2 | Medium | `src/components/Header.tsx` | The mobile drawer lacked complete Escape handling, focus management, backdrop dismissal, ARIA state, and a 44px trigger. |
| QA-07 | 0/2 | Medium | `src/components/Modal.tsx` | The shared dialog lacked labelled-dialog semantics, Escape dismissal, focus return, and Tab containment. |
| QA-08 | 0/3 | Medium | affected page files, `src/index.css` | Narrow form grids and fixed Aurora decoration had not been verified against the complete breakpoint matrix; decorative fixed elements inflated document width. |
| QA-09 | 0/2 | Low | `src/components/ui.tsx`, affected page files | Shared interactive primitives lacked consistent 44px touch targets, focus-visible styles, and accessible error announcements. |

## Fixes Applied

| ID | Fix Summary | Files Changed |
|---|---|---|
| QA-01 | Added `VITE_API_BASE_URL` support with the existing localhost fallback; added optional `AbortSignal` to all 16 frontend fetch functions. | `src/lib/engine.ts` |
| QA-02 | Added explicit response models to all eight active v2 FastAPI routes and introduced `EmergencyCaseOut` and `EmergencyHitOut`. | `backend/app/api/routers/v2_engine.py`, `backend/app/schemas/v2.py` |
| QA-03 | Added visible `ErrorNotice` feedback and `console.error` logging to all affected asynchronous flows. | `src/pages/Triage.tsx`, `Cost.tsx`, `Insurance.tsx`, `Facilities.tsx`, `Asha.tsx`, `src/components/ui.tsx` |
| QA-04 | Added loading guards, disabled submit controls, `finally` cleanup, and double-submit protection to asynchronous user actions. | `src/pages/Triage.tsx`, `Cost.tsx`, `Insurance.tsx`, `Facilities.tsx`, `Asha.tsx` |
| QA-05 | Added abort-controller cleanup for triage, affordability, cost, policy, scheme, facility, and ASHA synchronization requests. | `src/lib/engine.ts`, affected page files |
| QA-06 | Added 44px mobile menu trigger, `aria-expanded`, `aria-controls`, backdrop dismissal, Escape dismissal, focus entry, and focus return. | `src/components/Header.tsx` |
| QA-07 | Added `aria-labelledby`, Escape dismissal, initial focus, focus return, and Tab wrapping. | `src/components/Modal.tsx` |
| QA-08 | Changed affected narrow form grids to stack at the base width and added `overflow-x: clip` to prevent fixed Aurora decoration from expanding document width. | affected page files, `src/index.css` |
| QA-09 | Added minimum touch targets and `focus-visible` rings to shared buttons, toggles, and tabs; added accessible live error notices. | `src/components/ui.tsx` |
| QA-10 | Added the `lint` script as the project type-check command; no project dependency was added. | `package.json` |

## Verification Results

- **Type-check / lint / build:** Pass. `npm run lint` exited 0; `npm run build` exited 0 after the final CSS change. Final bundle: 480 transformed modules, approximately 1,517.34 kB uncompressed and 420.43 kB gzip.
- **Backend verification:** Pass. `python -m compileall -q app` exited 0; FastAPI `GET /health` returned HTTP 200 with `{"status":"ok","service":"SwasthyaSetu AI"}`; contract smoke tests passed for triage, policy, facilities, and emergency synchronization.
- **Offline browser smoke tests:** Pass. Triage failure displayed `Triage could not be completed…`; policy analysis displayed `Policy analysis failed. Check the connection and try again.`; cost estimation displayed `Cost calculation failed. Check the connection and try again.`; ASHA worker control room displayed `Emergency sync is unavailable. Showing the last saved local board.`; facilities displayed an accessible `role="alert"` error.
- **Async safety:** Pass. Affected handlers reset loading in `finally`, log non-abort failures with `console.error`, abort on unmount, and re-enable controls after failure.
- **Mobile navigation and modal:** Pass. At 320px, the menu trigger measured 44px by 44px. The keyboard probe confirmed focus entered the first drawer link, Escape changed `aria-expanded` from `true` to `false`, and focus returned to the trigger button.
- **Breakpoints re-checked:** Pass. Exact CSS viewports **320px, 375px, 414px, 768px, 1024px, 1440px, and 2560px** were tested across `/home`, `/triage`, `/cost`, `/insurance`, `/facilities`, and `/asha`. The final matrix reported zero horizontal overflow for all 42 route-width combinations. The mobile drawer was present at 320px, 375px, 414px, and 768px; desktop navigation was active at 1024px, 1440px, and 2560px.
- **Console review:** Pass for application errors. The only observed non-application entries were the known `THREE.Clock` deprecation warning from `@react-three/fiber` and an expected WebGL context-loss log during headless teardown.
- **Git checkpoint:** Not available. The project directory does not contain a Git working tree, so no commit checkpoint could be created.

## Items Requiring Your Decision

1. **Production CORS origins:** The backend remains limited to local development origins by design. Confirm the production frontend origins before expanding `allow_origins`; this was not changed unilaterally.
2. **Production API base URL:** Provide the deployment-specific `VITE_API_BASE_URL` at build time. The frontend now supports this variable and falls back to `http://localhost:8000/api` for local use.
3. **`THREE.Clock` deprecation:** Decide whether to upgrade or adjust the React Three Fiber/Three.js integration after reviewing compatibility. The warning originates in the dependency runtime, not application code.
4. **Headless WebGL context loss:** The console log appeared during browser teardown and did not correspond to an application failure. Confirm whether production monitoring should suppress or separately classify this expected lifecycle event.

**Stop status: Success. All nine QA checklist conditions pass.**
