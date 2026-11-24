# Document 9 — Testing & Quality Assurance Plan

## 1. Testing Pyramid

- **Unit tests (~70%):** deterministic safety gate, scheme-eligibility logic, cost-lookup logic, idempotency-key sync logic, follow-up scheduler logic — all pure/deterministic functions with no network dependency, cheap and fast to run on every commit.
- **Integration tests (~20%):** every API endpoint against a real (test) database; LLM cascade fallback behavior with providers mocked to simulate timeout/failure.
- **E2E tests (~10%):** the 6 critical user flows in §3, run in a real browser (Cypress or Playwright) against a running local stack.

## 2. Backend Test Matrix

For each endpoint: 2 happy-path, 2 edge-case, 2 adversarial/malicious-input tests.

### `POST /v2/triage`
| Test | Input | Expected |
|---|---|---|
| Happy 1 | `{text: "fever and cough", lang: "hi"}` | 200, `tier` returned, no crash |
| Happy 2 | `{image: <valid photo>, lang: "en"}` | 200, vision cascade result returned |
| Edge 1 | `{text: "", lang: "en"}` | 422, validation error, not a 500 |
| Edge 2 | `{text: <5000-char string>, lang: "en"}` | 422 (payload too large) or graceful truncation per defined max length |
| Adversarial 1 | Text containing a red-flag keyword split with zero-width characters or extra whitespace (e.g. `"c h e s t  pain"`) attempting to evade the scanner | Must still resolve to L4 — scanner normalizes whitespace before matching |
| Adversarial 2 | SQL-injection-shaped string in the `text` field (e.g. `"'; DROP TABLE users;--"`) | Treated as plain symptom text, Pydantic + parameterized queries prevent execution, 200 response, no DB impact |

### `POST /v3/referrals`
| Test | Input | Expected |
|---|---|---|
| Happy 1 | Valid patient_id + valid from/to facility IDs | 201, referral created with status `pending` |
| Happy 2 | Valid referral, immediately followed by a `PATCH` status update | 200, status transitions correctly, `patient_events` row appended |
| Edge 1 | `patient_id` that doesn't exist | 404, not a silently-created orphan referral |
| Edge 2 | `from_facility_id == to_facility_id` | 422, self-referral rejected |
| Adversarial 1 | Missing auth token | 401 |
| Adversarial 2 | Valid ASHA token attempting to PATCH a referral belonging to a different ASHA's patient with no shared facility relationship | 403 — authorization matrix (`03_SYSTEM_ARCHITECTURE.md` §11) enforced, not just authentication |

### `GET /v3/dashboard/district`
| Test | Input | Expected |
|---|---|---|
| Happy 1 | Valid `district_id`, ADMIN token | 200, aggregate JSON returned |
| Happy 2 | Repeat call within cache TTL | 200, served from cache (verify via response time or cache-hit header) |
| Edge 1 | `district_id` with zero recorded events | 200, all-zero aggregate, not an error |
| Edge 2 | Non-existent `district_id` | 404 |
| Adversarial 1 | ASHA-role token (not ADMIN) | 403 |
| Adversarial 2 | No token | 401 |

*(Apply the same 6-case pattern to every remaining endpoint in `03_SYSTEM_ARCHITECTURE.md` §7 before demo — the three above are the representative template, not the complete list to skip the rest.)*

## 3. Frontend Test Checklist (per page)

For every page in `05_FRONTEND_SPEC.md` §2, verify:
- [ ] Critical user flow completes end-to-end against the real backend
- [ ] Responsive layout correct at 375px, 768px, 1280px
- [ ] Empty state renders correctly (no patients yet, no referrals yet, etc.)
- [ ] Error state renders correctly (API failure simulated) — never a raw stack trace or blank screen
- [ ] Loading state renders correctly (throttled network simulation)
- [ ] All 9 languages render without layout breakage (long German-style word wrap is not the risk here, but Devanagari/Bengali conjuncts overflowing a fixed-width button is — check specifically)

**6 critical E2E flows to automate:**
1. Text triage → L4 result → facility routing
2. Image triage with all 3 vision providers mocked to fail → graceful `uncertain`
3. Cost estimate with PM-JAY eligibility → ₹0 result
4. ASHA offline capture → reconnect → sync with zero duplicates
5. Referral creation → status update → appears on receiving dashboard
6. Follow-up worklist → mark visited → entry clears

## 4. AI Safety Tests

- **Red-flag bypass attempts:** misspellings, transliteration variants (Hindi written in Latin script — "seene mein dard" for chest pain), code-switched sentences (Hindi+English mixed), and the zero-width-character evasion test from §2 — full corpus lives alongside the keyword list itself, versioned together.
- **Multilingual equivalence:** every one of the 41 red-flag concepts, tested in all 3 supported safety-critical languages (English/Hindi/Bengali), must produce the same L4 outcome — a translation gap here is a safety bug, tracked with the same severity as a missing English keyword.
- **Confidence calibration:** bucket a held-out test set by the cascade's reported confidence decile, compare to actual accuracy per bucket (`06_AI_MODEL_SPEC.md` §5) — flag any bucket where reported confidence overstates real accuracy by more than 15 percentage points.
- **Hallucination detection:** feed the cost-estimate scrape-fallback path (when enabled) a query for a disease/facility combination with no real source data available, confirm it returns `no_estimate_available` rather than a fabricated number.
- **Override-blocking verification:** construct a case where the vision cascade returns `non_serious` but the text input contains a red-flag keyword; confirm `vision_downgrade_blocked: true` in the response and a corresponding `safety_override_log` row.

## 5. Performance Benchmarks

| Target | Threshold |
|---|---|
| Deterministic safety-gate response | < 200ms |
| Full triage response (LLM cascade engaged), online | < 3s p95 |
| Frontend Time-to-Interactive (3G throttled, mid-tier device emulation) | < 5s |
| Bundle size | < 100MB total (single-file build) |
| Memory usage (2GB RAM device emulation) | No crash, no unresponsive-page browser warning during a full triage→cost→routing flow |
| Dashboard aggregate query (cache miss) | < 2s |
| Dashboard aggregate query (cache hit) | < 200ms |

## 6. Security Penetration Checklist

- [ ] SQL injection attempted on every text-accepting field (symptom text, patient display name, referral notes) — confirm parameterized queries hold
- [ ] XSS payload (`<script>alert(1)</script>`) in symptom text and patient name fields — confirm output is escaped on render, never executed
- [ ] JWT tampering: modify the payload of a valid token (e.g., change role from ASHA to ADMIN) — confirm signature validation rejects it
- [ ] JWT expiry bypass: attempt to use a token past its 24h expiry — confirm 401, and confirm the refresh-token flow (Audit #9 fix) requires separate valid credentials, not just a stale access token
- [ ] Rate limit verification: burst 250 requests/minute against a 200/min-limited endpoint — confirm 429 responses kick in correctly, not silent pass-through
- [ ] CORS enforcement: attempt a request from an origin not on the allow-list (`03_SYSTEM_ARCHITECTURE.md` §12) — confirm it's rejected, not silently permitted
- [ ] Role-escalation attempt: ASHA-role token calling an ADMIN-only route directly — confirm 403, not just a hidden-but-reachable UI gate

## 7. Accessibility Audit

- axe-core automated scan on every page — zero critical violations required
- Manual keyboard-only walkthrough of the 6 critical flows in §3 — every flow completable without a mouse
- Screen reader pass (NVDA or VoiceOver) specifically on `/triage/result`, given its safety-critical status
- Color contrast check on every custom color in the design tokens (`05_FRONTEND_SPEC.md` §8) against both text and background use cases

## 8. Pre-Demo Smoke Test — Exact 20-Step Checklist (run 1 hour before demo)

1. Backend responds to a health-check ping (confirms Render isn't cold/sleeping)
2. Database connection confirmed live (Neon dashboard shows active connection)
3. All 3 LLM provider API keys valid and under rate limit for the day
4. Frontend build deployed and loads from the actual demo device, not just a dev laptop
5. Text triage (English) returns a result within 3s
6. Text triage (Hindi, voice input) returns a result within 3s
7. A known red-flag phrase in all 3 safety-critical languages correctly returns L4
8. Image triage returns a result (or graceful `uncertain` if providers are saturated)
9. Airplane-mode/offline triage flow tested on the actual demo device, not just emulated
10. Cost Analyzer returns correct ₹0 result for the rehearsed PM-JAY demo case
11. Scheme eligibility check returns the expected scheme for the rehearsed demographic input
12. Facility routing map renders correctly on the demo device's actual screen size
13. ASHA login works with the demo account credentials
14. ASHA offline capture → sync flow completes without duplicate records
15. Referral creation flow completes and appears on the receiving dashboard within a few seconds
16. Follow-up worklist shows the seeded overdue test patient
17. District dashboard loads without a cache-cold delay (pre-warm it as step 0 of this checklist, not step 17)
18. `vision_downgrade_blocked` demo case (the "wow moment") rehearsed once, live, in the actual demo environment — not just tested in dev
19. Venue wifi/hotspot backup plan confirmed (mobile hotspot charged and tested, in case venue network is the actual failure point rather than the intentional demo one)
20. Team roles for the live demo confirmed — who's driving the keyboard, who's talking, who's on standby if something needs a manual restart mid-demo

## 9. AI Reliability Hardening — Additional Test Categories

`12_AI_RELIABILITY_HARDENING_PLAN.md` Part D adds 7 further test categories specific to hallucination risk in the Cost Analyzer and AI Symptom Detector (grounding-quote verification, phantom-metric rejection, eligibility boundary fuzzing, confidence calibration audit, cross-model disagreement escalation, hedging/negation adversarial set, live-provider drift regression). Treat that table as an extension of this document, not a separate concern — run it alongside §2-§6 above, not instead of them.
