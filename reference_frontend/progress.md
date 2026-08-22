# SwasthyaSetu AI — ASHA Portal & QA Progress

## Design Brief

| Decision | Project-specific outcome |
|---|---|
| Visual thesis | Turn the ASHA route into a calm frontline command center: a deep trust-blue workspace where community profiles, patient registration, and red emergency dispatch signals are legible at a glance. |
| Audience | ASHA/ANM/CHO field workers using phones, tablets, or low-powered laptops in offline or intermittent-connectivity settings. |
| Primary action | Login into the worker workspace, then register a community patient or dispatch the critical emergency case. |
| Information hierarchy | Public view: worker directory and portal entry. Dashboard: worker status, sync state, key metrics, registration action, history, and emergency board. |
| Type system | Existing DM Sans body, Space Grotesk section/display accents, compact uppercase utility labels, tabular numerals for patient counts and vitals. |
| Color system | Obsidian trust-blue background; cyan/emerald for operational status; amber for pending follow-up; red/orange for emergency dispatch; white/blue-gray for supporting copy. |
| Spatial rhythm | 4px rhythm; max-width 1280px; responsive directory grid; dashboard uses a two-column workspace on desktop and stacked cards on small screens. |
| Shape system | 18–24px glass panels, subtle borders, 44px touch controls, high-contrast emergency card, and restrained shadow/elevation. |
| Motion language | Public-to-dashboard crossfade, staggered worker/patient cards, modal presence/exit, subtle hover lifts, and reduced-motion fallbacks. Frequent animation uses opacity/transform; no decorative layout loops. |
| Responsive behavior | Directory cards collapse to one column; dashboard panels stack; emergency actions remain visible; no horizontal overflow at narrow or desktop viewports. |
| Content strategy | Mock data is explicitly labelled; emergency assessment shows symptom, urgency, location, and dispatch path; registration validation is inline and no dead-end buttons remain. |
| Verification plan | `npm run lint`, `npm run build`, browser checks for `/asha` public/login/dashboard/register/emergency flows, rapid route switching, overflow, console, focus, motion, and static scan for dead-end anchors. |

## Contract

**User goal:** Build the ASHA Health Worker tab at `/asha` with public and logged-in states, worker directory cards, login/register actions, a worker dashboard with patient registration and history, a high-visibility emergency action board, and a rigorous QA/performance loop across the existing frontend.

**Iteration cap:** 15

**Stagnation limit:** 3 consecutive iterations without net progress

### Definition of Done

- [ ] 1. `npm run lint` exits 0 with no TypeScript errors.
- [ ] 2. `npm run build` exits 0 with no build errors.
- [ ] 3. `/asha` public state renders worker directory cards with names, expertise/training tags, experience, Login, and Register actions.
- [ ] 4. Login transitions to the worker dashboard with a smooth state change and operational metrics.
- [ ] 5. Dashboard registration form validates required fields and adding a patient updates the community history.
- [ ] 6. Emergency action board visibly shows a mocked AI emergency assessment, location/map pin, symptom details, and dispatch action.
- [ ] 7. Emergency state can be supplied by the triage route through shared mock sync state and is represented in the ASHA board.
- [ ] 8. Rapid route switching and affected routes show no unhandled runtime errors, no horizontal overflow, and no obvious state degradation.
- [ ] 9. Affected controls are wired to state changes, modals, or routes; there are no `<a href="#">` dead ends; motion is reduced under `prefers-reduced-motion`.
- [ ] 10. A concise performance audit report records verified optimizations, known warnings, and limitations.

**Unverifiable or excluded criteria:** A literal 60fps guarantee cannot be independently established in this sandbox without a production device matrix; it will be treated as a best-effort performance audit with evidence from bundle/build inspection, animation-property review, and browser runtime checks. Real authentication, real patient records, live dispatch, and real geolocation are out of scope because the requirements specify local state and mocked sync.

## Dependency Order and Plan

1. Add shared emergency sync state and replace the ASHA route surface.
2. Run lint/build and correct any implementation issues.
3. Verify public/login/dashboard/register/emergency interactions and triage-to-ASHA sync.
4. Run rapid switching, overflow, console, dead-end, and motion-property checks.
5. Deliver the implementation and performance audit report.

**Current target:** Implement the ASHA public and worker views with shared mock emergency sync.

**Stagnation count:** 0

## Iteration Log

## Stop Status

**Status:** In progress

**Last blocker or next action:** Add the shared emergency sync context and premium ASHA route, then run the first compile verification.

### Iteration 1
- Targeted: Conditions 1–3 and implementation prerequisite.
- Action: Added `EmergencySyncProvider`, `AshaExperience`, ASHA-specific styles, router wiring, and triage-to-ASHA emergency sync; ran lint/build.
- Verify result: FAIL — lint exited 1 with `TS17002: Expected corresponding JSX closing tag for 'motion.div'` in the initial compact ASHA render branch.
- Diagnosis (if FAIL): The first one-line ternary render omitted the dashboard motion wrapper close tag. The component was rewritten into explicit `publicView` and `dashboardView` branches to make the JSX structure attributable and compiler-safe.
- Checklist status: 0 / 10 conditions passing; compile gate blocked.
- Stagnation count: 0

### Iteration 2
- Targeted: Conditions 1–2 — compile gates after diagnosis.
- Action: Re-ran lint and production build against the rewritten ASHA component.
- Verify result: PASS — `npm run lint` exited 0 and `npm run build` exited 0; client and server bundles emitted successfully. Existing large-client-chunk warning remains non-blocking.
- Diagnosis (if FAIL): None.
- Checklist status: 2 / 10 conditions passing; browser verification remains.
- Stagnation count: 0

### Iteration 3
- Targeted: Conditions 3–6 and 8–9 — public portal, dashboard, registration, emergency board, and route-level QA.
- Action: Entered `/asha` from the landing route, verified the public directory with four worker cards, opened the login transition, submitted a new patient record (`Nandita Roy`), confirmed it appeared first in history and selected handover, then queued the emergency dispatch response. Measured the live page with browser DOM inspection.
- Verify result: PASS — public controls and worker cards rendered; dashboard showed registry metrics, patient history, handover brief, emergency assessment, map pin, Call 108, and dispatch action; the new patient and success toast appeared; dispatch changed to `DISPATCH QUEUED`; `documentWidth=1265` equaled `viewportWidth=1265`; `deadEndAnchors=0`.
- Diagnosis (if FAIL): None.
- Checklist status: 8 / 10 conditions passing; triage-to-ASHA sync and final performance audit remain.
- Stagnation count: 0

### Iteration 4
- Targeted: Condition 7 — real triage-to-ASHA emergency sync.
- Action: Entered triage through the dashboard, selected the chest-pain emergency preset, ran analysis, opened the persistent route menu without reloading, and navigated to `/asha`.
- Verify result: PASS — the ASHA dashboard displayed `Live AI sync · AI triage`, the full Mitali Das assessment, `RED · LEVEL 1 — Immediate medical attention`, location `Agradwip Gram, Katwa Block`, and the dispatch action.
- Diagnosis (if FAIL): None.
- Checklist status: 9 / 10 conditions passing; final audit report remains.
- Stagnation count: 0

### Iteration 5
- Targeted: Conditions 8–10 — final performance, dead-end, and runtime QA.
- Action: Measured the final ASHA dashboard DOM, inspected the browser console after rapid route switching, reviewed the new motion/CSS implementation, and attempted a repository-wide dead-end source scan.
- Verify result: PASS — `horizontalOverflow=false`, `documentWidth=1265`, `viewportWidth=1265`, `deadEndAnchors=0`, `nativeControls=35`, and reduced-motion media support was present. The console contained only the known THREE.Clock deprecation and expected WebGL context-loss logs; no uncaught application errors or failed critical requests appeared. The repository-level Git scan returned no matches/output because the attached folder is not exposed as a Git working tree in this environment; the live DOM scan is the authoritative dead-end evidence for the affected route.
- Diagnosis (if FAIL): None for the application. The literal 60fps guarantee remains best-effort and is reported as such.
- Checklist status: 10 / 10 conditions passing.
- Stagnation count: 0

## Stop Status

**Status:** Success

**Last blocker or next action:** None. The ASHA portal and bounded QA loop are complete. Known limitations are mock authentication, mock patient records, mock emergency dispatch, existing WebGL deprecation/context-loss warnings, and the non-blocking large client bundle warning.

## Performance Audit Report

The ASHA route uses a single existing Framer Motion system and limits frequent animation to opacity and transform. Public worker cards and patient history use staggered entry transforms; state transitions use `AnimatePresence`; modal and toast transitions use opacity/translate; emergency pulsing is isolated to CSS enhancement and is disabled under `prefers-reduced-motion`. The dashboard uses CSS grid/flex composition, `overflow-x: clip`, and responsive breakpoints to avoid horizontal overflow. Shared emergency state is isolated in a small context with a memoized value and does not introduce additional route-level subscriptions. The final browser audit found no uncaught errors, no critical failed requests, no dead-end anchors on the affected route, and no horizontal overflow. The bundle remains large because the broader application includes the existing WebGL stack; route-level code splitting is a future optimization rather than a requirement for this mock frontend scope.

### Final completion pass

Audited the remaining production-quality gaps and corrected the landing WebGL scene. `InteractiveScene.tsx` now accumulates frame delta time instead of reading the deprecated `THREE.Clock` elapsed-time API, and the `Float` enhancement fully stops under reduced motion instead of only stopping custom rotation. The final verification passed: `npm run lint` exited 0 and `npm run build` exited 0. The existing large-client-chunk warning remains a bundle-optimization opportunity, not a build failure.

### Completion audit verification

The final rebuilt artifact loaded successfully at `/` and reached `/asha` through the live landing navigation. The fresh ASHA DOM check found four worker cards, one Login control, zero dead-end anchors, and no horizontal overflow (`documentWidth=1265`, `viewportWidth=1265`). Lint and production build both pass after the WebGL timing cleanup. The remaining `THREE.Clock` warning is emitted by the installed `@react-three/fiber@9.7.0` runtime against the deduplicated `three@0.185.1` dependency tree, not by application source usage; application calls to `getElapsedTime` have been removed. It is therefore retained as an explicitly documented dependency-level limitation rather than hidden or suppressed.

**Final status:** Complete for the supplied frontend scope, with mock integrations and the dependency-level runtime warning documented.
