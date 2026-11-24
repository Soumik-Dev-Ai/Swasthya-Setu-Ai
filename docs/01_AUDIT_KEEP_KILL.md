# Document 1 — Old Prototype Audit: Architecture Autopsy & Keep/Kill Decision
**Basis:** your `complete_project_context.md` technical spec. **Not a source-code review** — I don't have your repository, only your written spec, so any finding about internal code structure is explicitly hedged as a risk-to-verify, not an observed defect. Confirm these against real code in your Day-1 review (see `08_ROADMAP_EXECUTION_PLAN.md`).

---

## 1.1 Architecture Autopsy Report

| # | Category | Flaw | Severity | Impact on Users | Root Cause | Fix in New System |
|---|---|---|---|---|---|---|
| 1 | Data Integrity | Only 16 hospitals seeded; any village outside that radius gets no routing result | High | A patient in an unserved area sees an empty facility list, which reads as "no help exists" rather than "our data is incomplete" | Manual seed dataset, never expanded past demo scope | Facility Router degrades to tier-appropriate defaults (Sub-Centre/PHC) instead of an empty state (see `03_SYSTEM_ARCHITECTURE.md` §3, Facility Router) |
| 2 | Data Integrity | `quality_score` / `price_index` on hospital records appear to be hand-assigned, with no documented, reproducible scoring formula | Medium | A judge asking "how is this score computed?" gets no defensible answer live on stage | No formula was ever written down alongside the seed data | Document the scoring formula explicitly as versioned config (`07_DATA_CATALOG.md`), or drop the score in favor of raw, explainable fields (bed count, ICU, NABH status) if no formula can be reconstructed in time |
| 3 | Data Integrity | Cost estimates use flat national figures with no state-level cost-of-living adjustment | Medium | Rural Bihar and rural Kerala get identical estimates despite real cost differences | Curated DB built once, not regionalized | Out of scope for the hackathon timeline — disclose this as a known limitation in the demo rather than pretend precision that isn't there |
| 4 | AI Safety | The 41-keyword safety list is described as hardcoded, with no evidence of an automated test suite that runs against it on every change | Critical | A single accidental edit (e.g., a merge conflict resolution that drops one keyword) becomes a silent patient-safety regression with nothing to catch it | No CI gate tied to the safety-critical code path | New CI pipeline (`03_SYSTEM_ARCHITECTURE.md` §9) runs the full adversarial safety test suite (`09_QA_TEST_PLAN.md`) on every commit; a failing safety test blocks merge, full stop |
| 5 | AI Safety | LLM-cascade confidence scores are never validated against actual accuracy at that confidence band (no calibration check described) | Medium | A "90% confidence" reading may not mean anything close to 90% real accuracy, which misleads the transparency claim in `04_AI_SAFETY_ETHICS.md` | No evaluation harness was built for this specifically | Add a calibration check to the evaluation framework in `06_AI_MODEL_SPEC.md` §5 — bucket predictions by confidence decile, compare to actual accuracy per bucket |
| 6 | AI Safety | `vision_downgrade_blocked` events are returned to the frontend but not confirmed to be persistently logged | High | Nobody can audit, after the fact, how often the safety override actually fired, which is exactly the evidence you'd want in front of judges or a real deployment reviewer | Logging wasn't specified as part of the original safety layer design | Every override event writes a row to a new `safety_override_log` table (§6 below) — this becomes a demo asset, not just an internal safeguard |
| 7 | Security | No documented CORS allow-list — likely a permissive `*` origin policy from hackathon-speed shortcuts | High | Fine for a demo; a real security hole the moment this touches real patient data | Demo-speed shortcut, common and forgivable at prototype stage, not acceptable going forward | Explicit CORS allow-list scoped to the Vercel deployment origin only (`03_SYSTEM_ARCHITECTURE.md` §8) |
| 8 | Security | SlowAPI rate limiting is in-memory, single-process — resets on every Render redeploy and won't hold across multiple instances | Medium | Not exploitable at hackathon scale; would be trivially bypassable at real scale | Free-tier hosting constraint, not a code defect | Accepted limitation for the hackathon; documented as a known scaling gap rather than silently ignored |
| 9 | Security | JWT uses a single long-lived shared secret with no rotation policy, and 24h expiry with no refresh-token flow means users are logged out mid-session with no graceful re-auth | Medium | An ASHA worker mid-field-capture gets logged out with no warning | No refresh-token design in v1 | Add a refresh-token endpoint (`03_SYSTEM_ARCHITECTURE.md` §7 API spec) — small addition, meaningful UX fix |
| 10 | Scalability | SQLite (dev) vs PostgreSQL (prod) type-enforcement differences can hide bugs that only surface in production | Medium | A field that silently coerces in SQLite but throws in Postgres passes local testing and fails live | Convenience of zero-setup local dev | Alembic migrations become the single source of schema truth, tested against both engines in CI |
| 11 | Scalability | No caching layer — every facility search recomputes from the DB | Low | Not a problem at hackathon scale; a real cost at real scale | Not needed yet | Explicitly deferred — noted, not built, to avoid adding complexity the demo doesn't need |
| 12 | Offline Resilience | No documented conflict-resolution rule for a record edited both offline-locally and server-side before reconnect | Medium | Rare in a hackathon demo, real in a multi-ASHA field deployment | Idempotency key design solved duplicate-write, not conflicting-write | Last-write-wins by `updated_at` timestamp, explicitly documented (not silently assumed) in `03_SYSTEM_ARCHITECTURE.md` §3 |
| 13 | Offline Resilience | Client-side dataset fallback (16 hospitals/10 diseases/8 schemes) has no versioning, so an offline device can serve stale data indefinitely with no signal that an update exists | Low-Medium | A stale price or a closed facility could be shown as current with no visible warning | Fallback was designed for availability, not freshness-awareness | Add a `dataset_version` field checked opportunistically on any successful network call; UI shows a subtle "data may be outdated" flag if the local version is stale |
| 14 | UX & Accessibility | No confirmed WCAG 2.1 AA audit has actually been run — it's an aspirational NFR, not a verified one | High | Real risk of excluding low-vision or motor-impaired users, and a real risk of losing marks on the SIH "User Experience" rubric criterion | Never scheduled as a discrete task | `09_QA_TEST_PLAN.md` makes this a first-class, scheduled checklist item, not an assumption |
| 15 | UX & Accessibility | "ASHA Kiosk Mode" is a named concept in the pitch deck with no concrete UI spec behind it before this documentation suite | Medium | Risk of the PPT claiming a feature that doesn't fully exist in the build | Marketing-ahead-of-engineering gap, common in hackathon pitches | Fully specified in `05_FRONTEND_SPEC.md` §3 — build it to match what you're already claiming, not the reverse |
| 16 | Code Architecture (risk to verify, not confirmed) | A single "engine" router serving `/triage`, `/cost`, `/schemes` suggests business logic may be co-located with route handlers rather than separated into a service layer | Medium | Harder to unit-test business logic independent of HTTP, harder for 6 people to work in parallel without merge conflicts | Fastest path to a working demo under time pressure — a completely reasonable original tradeoff | Explicit service/repository layering recommended in `03_SYSTEM_ARCHITECTURE.md` §3 — confirm current state in Day-1 review before assuming this needs work |
| 17 | API Design | v1 (mobile-sync) and v2/v3 (engine) routers appear to have evolved separately and may use inconsistent response/error shapes | Medium | Frontend has to special-case error handling per API version | Incremental feature addition without a shared contract | Standardize a single error envelope `{error: {code, message, details}}` across all versions before further feature work |
| 18 | Testing | No confirmed automated test suite for the safety layer against multilingual adversarial phrasing | Critical | The single most safety-critical claim in the whole product (deterministic override) has never been proven against a real adversarial set | Never built, only designed | Becomes test-suite priority #1, blocking every other CI run — see `09_QA_TEST_PLAN.md` §4 |

## 1.2 Feature Gap Analysis (vs. SIH26133 requirements)

| Feature required by SIH26133 | Old prototype status | Gap | Priority |
|---|---|---|---|
| Digital triage | 🟢 Built | None | — |
| Multilingual interaction | 🟢 Built (9 languages) | None | — |
| Low-connectivity operation | 🟢 Built | None | — |
| Frontline health-worker support | 🟢 Built (ASHA sync) | None | — |
| Emergency escalation | 🟢 Built | Logging gap (§1.1 #6) | P0 fix |
| Referral tracking across tiers | 🔴 Absent | Full build required | P0 |
| Longitudinal patient records | 🔴 Absent | Full build required | P0 |
| High-risk follow-up (maternal/child/chronic) | 🔴 Absent | Full build required | P1 |
| Diagnostic/medicine-availability visibility | 🔴 Absent | Full build required (as a periodic snapshot, never a live feed) | P1 |
| Facility/district dashboards | 🔴 Absent | Full build required | P1 |
| Standards-based interoperability | 🔴 Absent (roadmap-only) | Build to FHIR-shaped schema, not live ABDM | P2 |
| Assisted teleconsultation | 🔴 Deliberately excluded (architectural choice) | Not a gap to close — a design decision to defend explicitly in the submission | N/A |

## 1.3 What to KEEP

- **The deterministic safety gate's core rule** — an AI reading can never downgrade a text-triggered red flag. This is your strongest architectural decision in the entire prototype. Do not touch the rule itself, only its testing and logging rigor (§1.1 #4, #6).
- **Offline-first design with client-side dataset fallback.** Genuinely rare among student hackathon submissions; this is a real differentiator, not a shortcut.
- **The 3-stage LLM cascade with graceful `uncertain` fallback.** The "never crash, degrade honestly" pattern is correct and should be the template for every new AI-touching feature you add (follow-up engine, dashboard aggregation).
- **The `(worker_id, device_local_id)` idempotency key for ASHA sync.** Solid, standard, correct pattern — extend it to the new `patient_events` writes rather than inventing a different scheme.
- **Deterministic (non-LLM) scheme-eligibility and cost-lookup logic.** Keeping the money-and-eligibility path free of LLM involvement is the right call and should stay that way for every new financial feature.
- **The free-tier-only, ₹0 infrastructure discipline.** Genuinely followed, not just claimed — extend the same discipline to the new tables, CI/CD, and dashboard caching rather than reaching for a paid add-on under time pressure.
- **The glassmorphism visual identity.** This is a real differentiator against the "utilitarian government portal" aesthetic most competing teams will produce, not just decoration — keep it, and extend it consistently into the new dashboard/timeline/referral screens rather than let those feel bolted-on.

## 1.4 What to KILL / rebuild

- **Undocumented, unversioned safety keyword list** → move it into a reviewed config file with its own change log and a CI gate that blocks any change failing the adversarial test suite.
- **Implicit/permissive CORS policy** → explicit allow-list, scoped to your actual deployed frontend origin.
- **Long-lived JWT with no refresh flow** → add a refresh-token endpoint.
- **Unlogged safety-override events** → persistent `safety_override_log` table.
- **Inconsistent v1/v2/v3 error response shapes** → one standardized error envelope across the whole API surface.
- **The absence of referral tracking, patient records, follow-up engine, and dashboards** — these aren't "flaws" in the old build, they're the honest gap between a working v1 prototype and what SIH26133 actually asks for. Build them net-new per `02_PRD.md` FR-9 through FR-13.

## 1.5 New table needed to support Fix #6 (safety-override logging)

```sql
CREATE TABLE safety_override_log (
    id             UUID PRIMARY KEY,
    triage_event_id UUID,
    override_type  VARCHAR(40) NOT NULL,   -- e.g. "vision_downgrade_blocked"
    text_signal    VARCHAR(20),            -- what the deterministic scan found
    vision_signal  VARCHAR(20),            -- what the vision cascade returned
    created_at     TIMESTAMPTZ DEFAULT now()
);
```
This table exists purely so you can show judges a real number — *"our safety override fired N times during testing, here's the log"* — rather than asserting the mechanism works without evidence.
