# Document 8 — Development Roadmap & Execution Plan
**Team:** 6 members — FE1, FE2 (Frontend), BE1, BE2 (Backend), AI (AI/ML), QA (QA + Design support)
**Window:** 6 weeks, on top of the existing v1 prototype — this is a gap-closure plan, not a from-zero build (see `01_AUDIT_KEEP_KILL.md`)

---

## Phase 0 — Week 1: Foundation & Audit Fixes

**Scope note added per `16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md`:** the two tasks below are real additional scope on top of everything already in this roadmap. Decide explicitly what they displace rather than silently stacking them on — same discipline already applied to the RAG system's scope note in `14_RAG_SYSTEM_DESIGN.md` §7.

| Task | Hours | Role | Dependencies | Definition of Done |
|---|---|---|---|---|
| Build the Intent Classifier (deterministic pass + LLM fallback) | 6 | BE1 | Safety gate unchanged | Mixed-intent inputs correctly route to both pipelines; classifier never bypasses the safety gate in testing |
| Build the Government Financial ETL pipeline skeleton (acquisition + extraction + mechanical verification + automated recency resolution) | 12 | BE2 + AI | Government source allow-list finalized (`07_DATA_CATALOG.md`) | A test run against two versions of one source (e.g., a CGHS rate PDF and its later revision) correctly resolves the per-procedure current value with no manual intervention |

| Task | Hours | Role | Dependencies | Definition of Done |
|---|---|---|---|---|
| Set up CI pipeline (`03_SYSTEM_ARCHITECTURE.md` §15) | 6 | BE1 | Repo access | `ci.yml` runs on every push; safety-tests job blocks merge on failure |
| Write adversarial safety test suite (100+ phrasings, 3 languages) | 10 | AI + QA | Keyword corpus from `04_AI_SAFETY_ETHICS.md` | Suite passes locally and in CI; ≥0.95 emergency recall confirmed |
| Add CORS allow-list + JWT refresh-token endpoint (Audit #7, #9) | 5 | BE2 | None | Old permissive CORS removed; refresh flow tested manually |
| Add `safety_override_log` table + write path (Audit #6) | 3 | BE1 | DB migration tooling in place | Every `vision_downgrade_blocked` event produces a row |
| Alembic migration for new tables (`patient_records`, `patient_events`, `referrals`, `follow_up_worklist`, `facility_capacity_snapshot`, `safety_override_log`) | 6 | BE2 | Schema finalized (`03_SYSTEM_ARCHITECTURE.md` §6.2) | Migration runs clean against both SQLite (dev) and Postgres (Neon) |
| Design tokens + component library skeleton (`05_FRONTEND_SPEC.md` §8–9) | 8 | FE1 | None | Tokens committed as CSS variables; Storybook or equivalent shows base components |
| Expand facility dataset via HFR public directory (Audit #1) | 6 | QA | Data Catalog §1 | Facility count meaningfully expanded beyond 16, still ₹0 |

**Phase 0 exit criterion:** CI is green, the safety test suite exists and passes, and the new tables exist in both environments. Nothing user-facing needs to be done yet — this phase is entirely foundation.

## Phase 1 — Weeks 2–3: Core Backend + Frontend Shell

| Task | Hours | Role | Dependencies | Definition of Done |
|---|---|---|---|---|
| `POST /v3/patients`, `GET /v3/patients/{id}/timeline` | 8 | BE1 | Phase 0 migrations | Endpoints pass the 6 test cases in `09_QA_TEST_PLAN.md` §2 |
| `POST /v3/referrals`, `PATCH /v3/referrals/{id}` | 8 | BE2 | Patient endpoints | Referral status transitions correctly logged as `patient_events` |
| `/asha/patients` + `/asha/referrals` pages (shell, no polish yet) | 12 | FE1 | Backend endpoints above (can start against mocked responses in parallel) | Pages render, forms submit, list/detail views populate from real API |
| Standardize error envelope across v1/v2/v3 (Audit #17) | 4 | BE1 | None | Every endpoint returns `{error: {code, message, details}}` on failure |
| Follow-up worklist scheduled job (FR-11) skeleton | 6 | AI | Patient/referral tables | Cron-style job runs locally, flags a seeded overdue test patient |
| i18n key structure for new pages | 4 | FE2 | Design tokens from Phase 0 | New pages have translation keys wired for all 9 languages, even if not yet translated |

**Phase 1 exit criterion:** a patient can be created, referred, and their timeline viewed end-to-end through the UI, without polish.

## Phase 2 — Weeks 3–4: AI Extensions + Safety Hardening

| Task | Hours | Role | Dependencies | Definition of Done |
|---|---|---|---|---|
| Confidence calibration check (Audit #5) | 6 | AI | Evaluation harness | Calibration report generated: predicted vs. actual accuracy per confidence decile |
| `/asha/followups` page + "mark visited" action | 8 | FE2 | Follow-up job (Phase 1) | Worklist sorts correctly, marking visited clears the entry and writes an event |
| `GET /v3/dashboard/district` aggregation + caching (§16 cache strategy) | 10 | BE2 | Referral + follow-up data flowing | Dashboard query hits cache on repeat calls within TTL |
| `/admin/dashboard` page | 10 | FE1 | Dashboard endpoint | 4-card grid renders, manual refresh works, individual card skeleton-loads |
| Full translation pass for new pages (all 9 languages) | 8 | QA | i18n keys from Phase 1 | Native-script review completed for every new string, including the safety-critical follow-up copy |
| `facility_capacity_snapshot` seed + "last updated" UI treatment (FR-12) | 6 | BE1 + FE2 | Facility dataset expansion | Snapshot timestamp always visible, never implies live data |
| FHIR-India-shaped export endpoint (FR-14, stretch) | 8 | AI | Patient record schema stable | Exported JSON validates against a public FHIR India Core schema, no live ABDM call made |

**Phase 2 exit criterion:** every P0 and P1 feature from `02_PRD.md` is functionally complete, even if visually unpolished.

## Phase 3 — Weeks 4–5: Polish, Responsive, Accessibility

| Task | Hours | Role | Dependencies | Definition of Done |
|---|---|---|---|---|
| Responsive pass on all new pages (375/768/1280px) | 10 | FE1 + FE2 | Phase 2 complete | Manual check at all 3 breakpoints, no horizontal scroll, no clipped content |
| axe-core automated accessibility scan + fixes | 8 | QA | All pages built | Zero critical violations |
| Manual WCAG AA pass (keyboard nav, screen reader) on `/triage/result` and new pages | 6 | QA | Automated scan complete | Full keyboard walkthrough completes every flow without a mouse |
| Glassmorphism visual consistency pass on new screens (timeline, referral, dashboard) | 8 | FE1 | Design tokens | New screens visually match the existing v1 aesthetic, not bolted-on |
| RTL layout test (if Urdu included) | 4 | QA | i18n complete | Full mirrored layout confirmed, not just CSS logical properties assumed |
| Load/burst test on LLM cascade (simulate rapid judge testing) | 4 | AI | Cascade stable | Cascade degrades to `uncertain` gracefully under rate-limit pressure, never crashes |

## Phase 4 — Week 5–6: Testing Loop & Demo Prep

| Task | Hours | Role | Dependencies | Definition of Done |
|---|---|---|---|---|
| Full backend test matrix execution (`09_QA_TEST_PLAN.md` §2) | 8 | BE1 + BE2 | All endpoints built | 100% of listed test cases pass |
| Full frontend flow verification (`09_QA_TEST_PLAN.md` §3) | 8 | FE1 + FE2 | All pages built | Every critical flow checked at every breakpoint |
| Security pentest checklist (`09_QA_TEST_PLAN.md` §6) | 6 | QA | Full build | No SQL injection, XSS, or JWT-tampering vector found |
| Demo rehearsal ×3, timed | 6 | Whole team | All above complete | Demo consistently lands inside the 5-minute window (§ demo script below) |
| Pre-demo smoke test (20-step checklist, `09_QA_TEST_PLAN.md` §8) | 2 | QA | Rehearsals complete | Run 1 hour before actual demo, every step passes |

---

## Risk Register (Top 15)

| # | Risk | Prob (1-5) | Impact (1-5) | Mitigation |
|---|---|---|---|---|
| 1 | Render free-tier cold start delays the first live-demo request | 4 | 4 | Warm the backend with a request 15 minutes before going on stage; keep a local-run fallback ready |
| 2 | Neon free-tier storage/compute cap hit during heavy testing | 2 | 3 | Monitor usage weekly; purge test data before the finals |
| 3 | LLM provider free-tier rate limits hit during rapid judge testing | 3 | 4 | Cascade already degrades gracefully; add backoff/queueing; load-test in Phase 3 |
| 4 | Accidental edit silently breaks the safety keyword list | 2 | 5 | CI-gated adversarial test suite blocks any merge that fails it |
| 5 | Team member unavailable mid-sprint (exams, illness) | 3 | 3 | No single-owner modules; pair on critical-path items |
| 6 | Scope creep past the 6-week window | 4 | 4 | Hard P0/P1/P2 discipline from `02_PRD.md`; freeze scope after Phase 2 |
| 7 | FHIR export doesn't validate in time | 3 | 2 | It's explicitly P2/stretch — cut first if behind schedule |
| 8 | Sparse facility dataset undermines demo believability | 3 | 3 | Expand via HFR public directory in Phase 0, not last-minute |
| 9 | Live offline-demo fails because venue wifi doesn't cooperate on cue | 3 | 4 | Rehearse in actual airplane mode, don't rely on ambient network dying naturally |
| 10 | Judges probe the missing teleconsultation component | 4 | 3 | Rehearsed, explicit async-by-design answer ready (`02_PRD.md` Out of Scope) |
| 11 | Late-breaking accessibility failures with no time to fix | 3 | 3 | axe-core scan starts in Phase 2, not Phase 4 |
| 12 | Unreviewed machine-translated phrases ship into the safety-critical keyword list | 3 | 4 | Mandatory human review gate specifically for keyword translations |
| 13 | Dashboard queries slow the free-tier backend under demo load | 2 | 3 | 15-min cache TTL already defined; pre-warm cache before demo |
| 14 | Merge conflicts across 6 people editing overlapping files | 3 | 2 | Service-layer separation + clear module ownership |
| 15 | PPT claims outpace what's actually built by demo day | 3 | 5 | Audit every PPT claim against the real build 48 hours before demo; cut anything not true yet |

---

## Demo Script — Exact 5-Minute Flow

| Time | What to show | What to say |
|---|---|---|
| 0:00–0:30 | Title slide, team | Open with the stat: *"51.6% of rural CHCs are missing the specialists they need — and 70 to 77% of rural primary care already happens through informal providers with no clinical support."* |
| 0:30–1:30 | Live triage: enter a symptom by voice, in Hindi, on a throttled/offline connection | Show the multilingual, offline-first flow working with zero visible lag on the deterministic path |
| 1:30–2:30 | **The wow moment:** deliberately block all 3 LLM provider endpoints live, re-run the same red-flag phrase | *"Watch — the AI layer just failed completely. The safety classification didn't."* Point at the L4 badge and the `vision_downgrade_blocked` flag firing |
| 2:30–3:30 | Cost Analyzer: same case, show PM-JAY eligibility dropping the estimate to ₹0 at an empaneled facility | *"This is the piece almost nobody else builds — knowing you're safe isn't enough if you don't know you can afford to go."* |
| 3:30–4:15 | Referral creation from the triage result → ASHA view → patient timeline updates live | Show the Sub-Centre→PHC referral appear instantly on the receiving side — this is the SIH26133 "continuity" requirement, demonstrated, not claimed |
| 4:15–4:45 | District dashboard: referral completion rate, follow-up backlog | *"This is what a District Health Officer sees — not another paper report."* |
| 4:45–5:00 | Close | State the one differentiation line from `02_PRD.md` and the adoption path: *"We're not routing around the public health system — we're the layer that makes it visible to itself."* |

**What to explicitly skip in the 5 minutes (don't demo, but be ready to answer if asked):** FHIR export, on-device edge AI roadmap, SMS/WhatsApp nudges — these are documented as P2/roadmap, not part of the core demo, and claiming stage time for them dilutes the 5 minutes that actually differentiate you.
