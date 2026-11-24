# Document 27 — Frontend↔Backend Integration: Fix & Real Verification Prompt

**Source:** the 2026-09-10 integration report. This document doesn't redo the integration — most of it is solid — it closes three real gaps and a handful of smaller ones, and replaces "compiles and builds" with actual proof the wiring works.

## What's genuinely solid, not being touched

The audit-correction discipline in the report's §1, the decision to remove `rating`/`services`/`open24` rather than fabricate them, the `enrollment_method`-aware Apply button, ASHA phone masking, and the `as_of`/`last_verified_date` freshness labels all correctly apply this project's established rules. None of that needs rework — the fixes below are additive.

---

## Priority 1 (Critical) — fix before calling this integration done

### 1. No actual end-to-end verification exists yet

```
The current verification (tsc --noEmit, vite build, pytest in isolation)
proves the code is well-formed, not that it's wired correctly. Close this
gap for real:

1. Run the 6 critical E2E flows already specified in 09_QA_TEST_PLAN.md §3
   against the ACTUAL running system (backend live, frontend dev server
   pointed at it) — not mocked, not typechecked, actually clicked through
   or scripted via Cypress/Playwright per the original testing plan:
   - Text triage → result → facility routing
   - Image triage with a real (or deliberately-failing) vision call
   - Cost estimate with PM-JAY eligibility → correct result
   - ASHA login → registration → admin activation → login succeeds
   - Referral creation → status update → appears correctly
   - Follow-up worklist → mark visited → clears

2. For each flow, capture actual evidence — a passing Cypress/Playwright
   run's output, or a described manual session with what was entered and
   what rendered — not a summary claim of "works."

3. Specifically verify the auth flow end-to-end with real credentials:
   login → protected page loads → token expires or is force-invalidated →
   confirm the auto-refresh actually fires and the user isn't silently
   logged out or stuck.

Report actual results per flow, not a single "all wired correctly" line.
```

### 2. Confirm text-only triage actually reaches the Reasoning Engine, not just the Intent Classifier

```
Investigate before assuming either endpoint is correct:

1. Confirm exactly what POST /v3/intent returns — is it purely a routing
   decision ({intent, confidence, method} per 16_INTENT_ROUTING_AND_GOVT_
   FINANCIAL_PIPELINE.md §1), or has it been extended to also perform full
   triage analysis? If the latter, that's a real architectural drift from
   its documented single responsibility — flag it explicitly rather than
   silently accept it.

2. Confirm exactly what POST /v3/reason returns, and whether it's the
   text-path Reasoning Engine output from doc 22 item 6 (RAG-grounded,
   mechanically verified, same output contract as the vision path).

3. If /v3/reason is the correct endpoint for a full text triage result:
   fix the Triage page to call /v3/intent for routing (if routing is even
   needed client-side — it may be entirely a backend-internal concern) and
   /v3/reason for the actual analysis, not stop at intent classification.

4. Add a test that specifically asserts: a text-only, non-red-flag,
   clinically ambiguous triage input produces a response with a real
   grounding_reference that passes the mechanical verifier — the same
   proof-of-life check already required for the vision path in the
   Phase 3 gap report's Item A1, applied here to confirm text triage
   wasn't accidentally left ungrounded.

Report exactly what each endpoint does and which fix (if any) was needed.
```

### 3. Stop the landing page from showing fabricated numbers

```
Home.tsx and Landing.tsx still read FACILITIES/ASHA_WORKERS/TREATMENTS from
the mock data.ts for landing-grid counts. Fix this now, not as a future
deferral — a judge's first impression of this product showing fake stats
directly contradicts the anti-fabrication discipline applied everywhere
else in this integration.

1. Either wire these counts to real backend aggregate endpoints (e.g.,
   getAdminAnalytics-style counts, or a lightweight public stats endpoint
   if one doesn't exist yet and needs to be added), or remove the specific
   numeric claims from the landing page entirely if no real aggregate is
   available yet — an honest qualitative landing page beats a quantitative
   one built on mock data.
2. Once these pages no longer need data.ts, delete data.ts entirely rather
   than leave it in the repo as a temptation for the next feature to
   accidentally import from it.
3. Grep the full frontend for any other remaining import from data.ts to
   confirm nothing else was missed.
```

---

## Priority 2 (Real, fix in this pass) — architecture drift that will compound if left

### 4. Disease and city selectors are hardcoded — this breaks the autonomous-update architecture

```
The Cost page's 10-disease list and the Facilities page's 7-city list are
frontend reference lists, not fetched from the backend. This directly
undercuts 26_AUTONOMOUS_SOURCE_MONITORING_FRAMEWORK.md's whole point — when
that pipeline autonomously expands coverage (more diseases via doc 16 §2.5,
more cities via doc 25 §4), a hardcoded frontend list won't reflect it
without a manual code change and redeploy, silently defeating the
"autonomous" part for anyone actually using the app.

1. Add (or confirm existing) backend endpoints serving the current set of
   supported diseases and cities as data, not something the frontend needs
   to know in advance.
2. Wire Cost.tsx and Facilities.tsx to fetch these lists on load instead of
   importing a static array.
3. Confirm this doesn't break anything if the backend briefly returns a
   shorter list than the frontend expects (e.g., during a rollout) —
   render whatever the backend actually reports as available, don't assume
   a fixed count anywhere in the UI.
```

### 5. Verify 401 auto-refresh concurrency behavior explicitly

```
"Auto-refreshes on 401 once via a registered refresh handler" is ambiguous
in a way that matters: does a burst of simultaneous requests that all 401
around the same moment (token just expired) correctly deduplicate into ONE
refresh call with all requests waiting on it and retrying after, or does
each request independently trigger its own refresh call?

1. Write a test that fires several authenticated requests concurrently
   with an expired token and confirms exactly one call to /auth/refresh
   occurs, not one per failed request.
2. If the current implementation doesn't already deduplicate, fix it —
   multiple simultaneous refresh calls against a token endpoint is a
   classic race-condition source, especially if refresh tokens rotate
   (an earlier refresh call invalidating a token a later one still expects
   to use).
```

### 6. Add bounds-checking on the triage severity index mapping

```
`level - 1` mapping backend's 1-4 range onto the frontend's 0-3 LEVELS
array index has no described guard. Add one: if level is ever outside
[1,4] (malformed response, future backend change, etc.), fail visibly
(an explicit error state) rather than indexing out of bounds or silently
rendering an undefined/wrong severity badge — this is a safety-relevant
UI element, it should never fail silently.
```

---

## Priority 3 (Minor, worth a quick pass)

```
1. Update 25_FEATURE_UPDATE_INSURANCE_FACILITY_JWT.md §3 to reflect that
   directions_url is backend-served, not frontend-constructed from raw
   lat/lng as originally specified — the implementation choice is fine,
   the doc should match reality.
2. Correct the framing in the integration report's §1 point 6: the rule is
   "no live ad-hoc scraping at request time," not "no broader-than-7-city
   coverage, ever." Pan-India coverage remains exactly what doc 25 §4 /
   doc 26's autonomous pipeline is for — it's deferred because it hasn't
   been run yet, not because it's architecturally prohibited. Worth fixing
   this framing now so it isn't misremembered later as a hard ceiling.
3. Replace the plaintext-documented seed credentials (admin/admin123,
   asha1/asha123) with a note pointing to wherever real dev seed
   credentials are managed, or at minimum confirm these never resemble
   anything used outside local dev.
```

---

## Definition of done for this pass

Not "works perfectly" — the same calibrated target as everywhere else in this project: **every Priority 1 and 2 item has real evidence attached (a passing test, a described verified flow, a confirmed endpoint behavior), not a summary claim.** Priority 3 items are a quick pass, not a blocker. Report per item, same format as every prior phase in this project — what changed, what evidence proves it, what (if anything) is still open.
