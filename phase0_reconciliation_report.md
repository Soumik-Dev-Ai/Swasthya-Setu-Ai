# Phase 0 — Codebase Reconciliation Report
**Scope:** `backend/` (FastAPI), cross-checked against `docs/00`–`17` and `01_AUDIT_KEEP_KILL.md`. All claims below were verified by direct source reads on 2026-09-06. Review this report before authorizing Phase 1.

---

## 1. Audit Finding Verification (docs/01 §1.1 — 18 findings)

| # | Audit claim | Verdict | Evidence (file:line) |
|---|---|---|---|
| 1 | 16 hospitals; villages outside radius get no routing | **Confirmed** | `services/v2_data.py` (16-hospital in-memory set); `search_facilities` returns `[]` on no match; frontend offline fallback fabricates distances (`frontend/src/lib/engine.ts`) |
| 2 | `quality_score`/`price_index` hand-assigned, undocumented | **Confirmed** | `services/v2_data.py` — literal values, no formula or provenance field anywhere |
| 3 | Flat national costs, no regional adjustment | **Partially true** | `v2_engine.estimate_cost` applies `city.priceIndex` (0.78–1.18 across 7 cities) — coarse multipliers exist, but not state-level/research-backed |
| 4 | 41-keyword list has no CI-gated test suite | **Partially true** | Tests exist (`tests/test_adversarial_live.py`, 11 functions/12 cases incl. red-flag override + Hindi/Bengali phrases) but **no CI at all** — repo has no `.github/workflows` |
| 5 | No confidence calibration | **Confirmed** | No calibration harness anywhere in `backend/` |
| 6 | `vision_downgrade_blocked` not persistently logged | **Confirmed** | Field exists in response (`services/v2_engine.py:412`) but `safety_override_log` appears **nowhere** in `app/` |
| 7 | Permissive CORS `*` | **Not true** (milder than feared) | `main.py:28-34` uses explicit `CORS_ORIGINS` (`config.py:39`: localhost:5173/127.0.0.1:5173), `allow_credentials=True`; but `allow_methods=["*"]`, `allow_headers=["*"]`, and no production origin entry |
| 8 | SlowAPI in-memory, resets on redeploy | **Confirmed** | `core/limiter.py:11` — default `Limiter`, no storage configured |
| 9 | No refresh-token flow; 24h token | **Confirmed** | `routers/auth.py` has only `/login` + `/me`; `config.py:26` 1440-min expiry; no `JWT_REFRESH_SECRET` in config (doc 03 §13 expects it) |
| 10 | SQLite/Postgres drift risk | **Confirmed** | `main.py:47-50` auto-`create_all` on SQLite only; **zero Alembic migrations** (`alembic/versions/` = `.gitkeep` only) |
| 11 | No caching layer | **Partially true** | `services/cache.py` TTL caches exist (cost: 512 entries/24h, vision: 256/24h); facility search and auth uncached |
| 12 | No conflict-resolution rule for offline edits | **Confirmed** | `services/sync_service.py` updates in place on retransmit (implicit last-write-wins); never documented |
| 13 | Client fallback dataset unversioned | **Confirmed** | No `dataset_version` field in backend data or frontend store |
| 14 | WCAG audit never run | **Confirmed** | No axe-core config; a11y improvements exist (44px targets, focus traps) but no formal audit artifact |
| 15 | "ASHA Kiosk Mode" unspecced | **Not applicable as stated** | Doc 05 §3 now exists; a kiosk *mode* was never claimed in frontend code |
| 16 | Business logic co-located in route handlers | **Not true** | Clean split: routers (`api/routers/`) → services (`services/`) — layered properly |
| 17 | Inconsistent v1/v2 error shapes | **Confirmed** | Raw `HTTPException(detail=...)` strings throughout; no unified `{error: {code, message, details}}` envelope; 429 from SlowAPI differs again |
| 18 | No adversarial multilingual safety suite | **Partially true** | Coverage exists for EN + `सीने में दर्द` + `বুকের ব্যথা`; **no** transliteration/zero-width/code-switch/hedging cases; no 100+ phrase corpus |

**New findings not in the audit (Phase 0 discoveries):**

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| N1 | **Fail-open role mapping at login**: any `users.role` value other than exactly `"ASHA"` mints an **ADMIN** token | **Critical** | `api/routers/auth.py:26` `role = Role.ASHA if user.role == Role.ASHA else Role.ADMIN` |
| N2 | Public mock "emergency" endpoint returns realistic named patient-like records, unauthenticated | High | `routers/v2_engine.py:225-228` + `services/v2_engine.py` (`emergency_sync_cases` — hardcoded "Ramesh Kumar" etc.) |
| N3 | `JWT_SECRET` ships with `"dev-insecure-secret-change-me"` default; seeded `admin/admin123`, `asha1/asha123` | High | `core/config.py:24,30,33` |
| N4 | Swagger/Dev docs always exposed (`docs_url`, `redoc_url` unconditional); `ENV` setting defined but never read | Medium | `main.py:24-25`; `config.py:16` |
| N5 | Every public triage/cost/insurance call triggers a live DuckDuckGo OSINT query (no per-route limit, no flag gate); disclaimer string carries mojibake `"?? "` | Medium | `services/precision_service.py:7,9-33`; `routers/v2_engine.py:152,176-178,199-200` |
| N6 | Duplicate `Role` definitions (`core/security.py:14` Enum vs `models/user.py` constants) — deps/login import the latter, creating drift risk | Medium | both files |
| N7 | Advanced-search query params (`disease_id`, `severity`, `location_label`) bypass `SafeId` validation (unlike JSON bodies) | Medium | `routers/v2_engine.py:238-241` raw `str` params |
| N8 | Pricing LLM extraction timeout = **1.0s** (codified by test) — live reality will collapse this path to `no_estimate_available`; vision path has **no route-specific rate limit** | Medium | `services/pricing_service.py:190`; `routers/v2_engine.py:45` |
| N9 | Dead/orphaned code: unregistered `routers/triage.py` + `triage_service.py` (V1), unused `googlemaps` dep + `GOOGLE_MAPS_API_KEY` config, stale `scripts/smoke_test.py` (V1 shape, will fail), committed binary `swasthyasetu.db` | Low | file inventory |
| N10 | Deprecated `@app.on_event("startup")` API | Low | `main.py:41` |
| N11 | **Doc/code conflict**: doc 03 §16 says "vision results NOT cached (privacy)" — code caches vision results 24h keyed by image SHA | Medium | `services/vision_service.py:148,161,193,210` |

## 2. Status-Marker Corrections (02_PRD FRs / 03 Architecture / 06 AI Model)

| Marker | Docs say | Verified state | Correction |
|---|---|---|---|
| FR-1 text triage | 🟢 | Text triage works; **voice input removed from frontend** (empty placeholder in `Triage.tsx`); safety scan is not a separate <200ms pre-path — one endpoint call does everything | 🟢 → 🟡 |
| FR-2 image triage | 🟢 | Vision cascade fully implemented (`vision_service.py`) with cache + provenance, but **never live-tested** (provider keys unconfirmed) | 🟢 (unverified live) |
| FR-3 safety override | 🟢 | Fully true + test-backed (`safety_layer.py`, tests 4/5/7) | 🟢 confirmed |
| FR-4 cost analyzr | 🟢 | True for curated path; scrape path default-off; `ENABLE_WEB_SCRAPE` works | 🟢 confirmed |
| FR-5 scheme match | 🟢 | Deterministic, no LLM — confirmed | 🟢 confirmed |
| FR-6 facility routing | 🟢 | Backend true; **offline claim false** — maps need network tiles; frontend offline fallback invents random km distances | 🟢 → 🟡 |
| FR-7 ASHA capture | 🟢 | **Mock only** — `upload-form` discards the image and returns hardcoded fields; no client SQLite queue (localStorage, capped 12) | 🟢 → 🟡 |
| FR-8 auth & roles | 🟢 | JWT+roles exist, but findings N1/N3/N8 apply | 🟢 → 🟡 |
| FR-9/10/11/12/13/14/16 | 🔴 | Confirmed absent — no patient/referral/follow-up/capacity/FHIR/SMS code | 🔴 accurate |
| FR-15 9-language i18n | 🟢 | 9 dictionaries exist (`i18n.ts` ~2,981 lines) but data strings (conditions, advice, scheme names) remain English; RTL/Urdu untested | 🟢 → 🟡 |
| 03 §6.1 "existing tables" | 🟢 | Real tables: `users, triage_sessions, asha_records, facilities, pricing, schemes` — doc's `hospitals`/`diseases`/`triage_events`/`asha_sync_queue` tables **do not exist** (they're in-memory constants or differently named); `users.phone_hash` doc-only | Markers wrong |
| 03 Intent Classifier / Knowledge Engine / Grounding Verifier | 🔴 | Confirmed absent — no intent routing, no RAG/pgvector, no `grounding_reference` in real prompt | 🔴 accurate |
| 06 §6 "prompts 🟡 EXTENDED (grounding added)" | 🟡 | **Not implemented** — real vision prompt (`vision_service.py:68-77`) has no retrieved context or grounding field | 🟡 → 🔴 |
| 06 free-tier inventory | — | Model IDs match code (`vision_service.py:81-85`, `pricing_service.py:147-152`) | matches |

**Keyword-count truth:** docs claim **"41 keywords / 3 languages"**; actual `RED_FLAG_KEYWORDS` = **39 entries, 2 non-English** (`safety_layer.py:29-69`). The module's own docstring (lines 14-19) honestly states English-centric coverage. This is the single most load-bearing doc↔code mismatch and blocks any truthful demo claim until resolved.

## 3. Environment / Ops Baseline

- `.env` exists (gitignored ✔) with provider keys set but unverified as sandbox credentials → **live-call ceiling stays 0** (same rule as the certifications).
- `requirements.txt` floor-pinned only; `googlemaps` is a dead dependency; `duckduckgo-search` used at runtime by `precision_service.py` regardless of `ENABLE_WEB_SCRAPE`.
- No CI config anywhere. No `.env.example`. Binary `swasthyasetu.db` committed.

## 4. Scope Changes Discovered (must feed Phase 1)

1. **Add to Phase 1:** fix N1 (login role mapping), N3 (fail loudly on weak secrets outside dev), N2 (gate or clearly synthetic-ize the emergency-sync mock), N4 (env-gate docs URLs), N6 (single Role source), plus write alembic baseline migration for the **actual** current schema before adding new tables.
2. **Add to Phase 1 CI:** `test_safety_layer.py` doesn't exist as such — the adversarial file covers part of it; the dedicated 41-keyword × 3-language adversarial corpus (doc 09 §4) is genuinely missing.
3. **Decision required before Phase 3:** the vision-cache-vs-doc-03-§16 conflict (N11) — either keep cache + update doc with rationale, or drop cache.
4. **Decision required:** correct the "41 keywords / 3 languages" claim downward, or expand the list (with the mandatory human-translation review gate) — this is a demo-veracity item (risk #15).

## 5. Checkpoint Assessment

- [x] Full backend read (routers, services, models, schemas, tests, config, migrations dir)
- [x] All 18 audit findings adjudicated with citations: **12 confirmed, 4 partially true, 1 not true, 1 N/A**
- [x] All status markers in 02/03/06 verified; corrections tabled above
- [x] Reconciliation Report produced before any implementation code

**Go/No-Go for Phase 1: GO**, conditioned on Phase 1 absorbing the five new findings (N1–N4, N6) and the baseline-migration task identified above — none block the plan, but they're now mandatory in-scope items, not optional extras.
