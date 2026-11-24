# Frontend ↔ Backend Integration — Implementation Report

**Date:** 2026-09-10
**Scope:** Wire the mock `frontend 2.0/` (zero API calls, all data hardcoded in `src/lib/data.ts`) to the live FastAPI backend at `backend/`.
**Result:** Frontend compiles clean (`tsc --noEmit`) and builds (`vite build`, 2867 modules). Backend suite: 201 passed.

---

## 1. What the audit found (and the corrections applied up front)

The integration prompt assumed several endpoint shapes that do **not** exist in the real backend. Every wiring decision below follows the **actual** contracts, not the assumed ones. Key corrections:

1. **Phase 0A's "3 missing endpoints" were already built** earlier this session (ASHA discovery, ASHA registration, admin activate + pending list). Only CORS + the client layer + page wiring were actually outstanding.
2. **Triage** multipart uses `symptoms` / `flags` (JSON array) / `age` / `gender` / `image` — not `sex` / `duration`. Response is `{ level, emergency, matched, coverage, confidence, advice, flags, vision_signal, safety_audit, reasoning, ... }` — **not** `{ theLevel, checklist, facility }`.
3. **Cost** has **no** per-treatment static-price catalog endpoint. Real calculation is `POST /api/cost/alternatives` against the backend's **10 disease ids + 7 city ids + 4 severity levels**.
4. **Scheme matching** uses an enum vocabulary — `state` (2-letter), `income` (band 0–2), `category` (`cat.*`), `work` (`work.*`), `need` (`need.*`) — not free text.
5. **Facilities** are served from a curated static dataset keyed on 7 city ids with fields `tier / beds / er24 / icu / bloodBank / nabh / pmjay / priceIndex / score / lat / lon`. There is **no** `rating`, `services`, or `open24` — these were **removed** from the UI rather than fabricated.
6. **Pan-India coverage is deferred, not prohibited.** The rule is "no live ad-hoc scraping at request time," not "no broader-than-7-city coverage, ever." Pan-India facility coverage remains exactly what doc 25 §4 / doc 26's governed autonomous pipeline is for — it hasn't been run yet, but nothing forbids it. The live request-time Google Places/scrape path is what conflicts with doc 25 §0 + the no-billing rule, and is therefore not built (backend-served `directions_url` + `/routing/recommend` cover real routing needs today).

---

## 2. Backend changes (this phase)

| File | Change |
|---|---|
| `backend/app/core/config.py` | `CORS_ORIGINS` extended with `http://localhost:5174`, `http://127.0.0.1:5174`. |
| `backend/.env.example` | (earlier) `DEPLOYMENT_TARGET=cloud_production` documented for doc 24. |

No endpoint behavior was changed. Backend suite remained green (201 passed).

---

## 3. Frontend changes

### 3.1 New `src/lib/api.ts` — the single source of truth

A typed fetch client wrapping every endpoint used by the UI. Includes:
- `BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api"`.
- `ApiError` carrying HTTP status + the backend error-envelope message (`error.message`).
- `request<T>` that sets `Content-Type: application/json` only for non-FormData bodies, injects `Authorization: Bearer <token>`, and **auto-refreshes on 401 once** via a registered refresh handler.
- One exported function per endpoint, with TypeScript types mirroring `app/schemas/*`.

Endpoint → function map:

| API function | Route | Auth |
|---|---|---|
| `login` | `POST /auth/login` | public |
| `refreshToken` | `POST /auth/refresh` | public |
| `registerAsha` | `POST /auth/register-asha` | public |
| `analyzeIntent` | `POST /v3/intent` | public |
| `analyzeReason` | `POST /v3/reason` | public |
| `analyzeTriage` | `POST /triage/analyze` (multipart) | public |
| `getEmergencyRoute` | `POST /triage/emergency-route` | public |
| `getEmergencySync` | `GET /asha/emergency-sync` | public |
| `estimateCost` | `POST /cost/estimate` | public |
| `costAlternatives` | `POST /cost/alternatives` | public |
| `analyzePolicy` | `POST /insurance/analyze-policy` | public |
| `matchSchemes` | `POST /schemes/match` | public |
| `searchFacilities` | `POST /facilities/search` | public |
| `advancedSearch` | `POST /facilities/advanced-search` | public |
| `recommendRoute` | `POST /routing/recommend` | public |
| `getAshaWorkers` | `GET /v2/asha-workers/nearby` | public |
| `createPatient` | `POST /v3/patients` | ASHA/ADMIN |
| `getPatientTimeline` | `GET /v3/patients/{id}/timeline` | ASHA/ADMIN |
| `createReferral` | `POST /v3/referrals` (+ `Idempotency-Key`) | ASHA/ADMIN |
| `updateReferral` | `PATCH /v3/referrals/{id}` | ASHA/ADMIN |
| `getFollowups` | `GET /v3/followups` | ASHA/ADMIN |
| `completeFollowup` | `PATCH /v3/followups/{id}` | ASHA/ADMIN |
| `runFollowupScheduler` | `POST /v3/followups/run` | ADMIN |
| `uploadForm` | `POST /asha/upload-form` (multipart) | ASHA/ADMIN |
| `saveRecord` / `listRecords` | `POST|GET /asha/records` | ASHA/ADMIN |
| `syncBatch` | `POST /sync/batch` | ASHA/ADMIN |
| `reportCapacity` / `getCapacity` | `POST|GET /v3/facilities/capacity` | ASHA/ADMIN |
| `getAdminAnalytics` | `GET /admin/analytics` | ADMIN |
| `getDistrictDashboard` | `GET /v3/dashboard/district` | ADMIN |
| `getPendingAshaUsers` | `GET /admin/users/pending` | ADMIN |
| `activateAshaUser` | `PATCH /admin/users/{id}/activate` | ADMIN |

### 3.2 `src/store.ts` — real JWT auth

Replaced the fake `AuthUser { name, phone, role }` with `{ token, refreshToken, role, username }` (persisted via zustand). Added `signIn()` (calls `/auth/login`, stores tokens) and `signOut()`. Registers a refresh handler with `api.ts` so an expired access token is transparently refreshed via `/auth/refresh` once per request.

### 3.3 `src/components/LoginModal.tsx` — Phase 5A

Removed the hardcoded "any 10-digit phone" bypass. Now takes **username + password**, calls the real login via `signIn`, and navigates by the **decoded role** (`ADMIN → /app/admin`, else `/app/asha/portal`). A `PENDING_ASHA` account is refused with its pending-approval message (HTTP 403).

### 3.4 `src/vite-env.d.ts` (new)

`/// <reference types="vite/client" />` so `import.meta.env` typechecks under `tsconfig` (which sets `types: ["node"]`).

---

## 4. Page-by-page wiring

### Triage (`src/pages/Triage.tsx`)
- Replaced the local keyword-weight `analyze()` with real calls.
- Text-only → `analyzeIntent(text, flags)`; with image → `analyzeTriage(symptoms, flags[] as JSON string, imageFile)` multipart.
- Captured the actual `File` object (previously only a data URL) so the multipart upload works.
- Backend `level` (1–4) maps onto the existing 0–3 `LEVELS` index (`level - 1`); `result.emergency` drives the L4 emergency badge/call-108 action.
- Added an inline error surface on failure.

### Cost (`src/pages/Cost.tsx`)
- Replaced the static `TREATMENTS` grid + `govt * 1.55` formula with real data.
- Disease selector driven by a frontend reference list matching the backend's 10 disease ids (`delivery, cataract, knee, bypass, dialysis, dengue, typhoid, pneumonia, stroke, covid`); severity mapped `mild|moderate|severe|critical`; city constrained to the 7 supported city ids.
- `costAlternatives(cityId, diseaseId, severity)` results render per-hospital: name, tier, total (₹), affordability %, and the `as_of` freshness label.

### Insurance (`src/pages/Insurance.tsx`)
- Replaced the local `matchSchemes` filter with the backend `/schemes/match`.
- Adapters map UI selections → backend enums (`state` name→code, `income` ₹→band, `cat1..5`→`cat.*`, `emp1..4`→`work.*`, `need=need.general`).
- Scheme cards render **real** fields: `name`, `benefit` (coverage), `docs` (documents needed), `pct` (match %).
- **Phase 5B Apply button**: if `enrollment_method === "self_service_portal"` **and** `registration_portal_url` is present → direct new-tab link; otherwise honest guidance text per `enrollment_method` (new i18n keys `in.guidePortal/guideCsc/guideFacility/guideFallback`, `in.docs`).

### Facilities (`src/pages/Facilities.tsx` + `src/lib/MapView.tsx`)
- Replaced the 10-state cascading cascade with the 7 supported cities (backend city ids) + name search + honest filter chips (`PM-JAY`, `24×7 ER`, `ICU`, `Blood bank`, `NABH`).
- Backend `FacilityHit` → UI: `tier` → `private|district` type, `km`, `beds`, `er24` shows 24×7, capability chips from `icu/bloodBank/nabh`, PM-JAY badge, and `last_verified_date` in the footer.
- **Phase 5C Directions**: the backend-supplied `directions_url` renders a "Directions" link per card and in the detail popup.
- `MapView` was decoupled from the mock `Facility` type into a minimal `FacilityPin { id: string|number, type, lat, lng }` so backend rows drive the map pins directly.

### ASHA (`src/pages/Asha.tsx`)
- **Discovery** — replaced `ASHA_WORKERS` mock with `getAshaWorkers()`: shows `full_name`, `village_ward`, `district`, `specialities`, and **masked phone** (`phone_masked`).
- **Registration** — full real form → `registerAsha` (username/password/full_name/DOB/phone/aadhaar_last4/village_ward/district/state/specialities). Success shows the backend `message`.
- **Portal** — auth gate is now `token + role === "ASHA"` (was `user.role === "asha"`). Follow-up worklist loads from `getFollowups()`; "Mark visited" calls `completeFollowup(id)`.

### Admin (`src/pages/Admin.tsx`)
- Auth gate is `token + role === "ADMIN"`.
- Stats from `getAdminAnalytics()` (triage total, tier breakdown, ASHA records).
- Pending approvals from `getPendingAshaUsers()` → `activateAshaUser(userId)` on approve.

---

## 5. Auth flow (Phase 3)
- **Token management:** `token` + `refreshToken` persisted in the store.
- **Auto-refresh:** on a 401 from an authenticated call, `api.ts` asks the store's refresh handler to mint a new access token once, then retries. If refresh fails, it logs out and the page's auth gate re-shows the login modal.
- **Route guards** are page-level: `AshaPortal`/`Admin` render a login gate when `token` / `role` is wrong (ASHA-only vs ADMIN-only), and a non-admin hitting `/admin` gets the denial view.

---

## 6. Verification

| Check | Command | Result |
|---|---|---|
| TypeScript types | `npx tsc --noEmit` | ✅ clean (after fixing `noUnusedLocals`/`noUnusedParameters` violations) |
| Production build | `npm run build` (vite) | ✅ 2867 modules transformed, single-file bundle |
| Backend regressions | `pytest backend/tests` | ✅ 201 passed |
| Migrations | `alembic upgrade head` | ✅ chains to `0006_docs_24_25_26` head |

The `tsconfig` has `noUnusedLocals: true` / `noUnusedParameters: true`, so every unused import/local introduced during rewiring was removed (e.g., unused `get` param in `store.ts`, unused `MapPin` in `Facilities.tsx`).

**Tooling note:** `npm install` was run in `frontend 2.0/` to install dependencies (they were absent), then `tsc`/`build` were used to verify. No new runtime dependency was added (the client uses `fetch`).

---

## 7. Deviations & remaining items (honestly deferred)

| Item | Reason | Status |
|---|---|---|
| Pan-India facility live search (Google Places) | Conflicts with doc 25 §0 "no ad-hoc scraping" + no-billing rule | **Not built** — 7-city curated search + `directions_url` + `/routing/recommend` used instead. Coverage expansion = doc 25 §4 / doc 26 pipeline. |
| `data.ts` trimmed to only reference lists (Phase 4A) | `Home.tsx` / `Landing.tsx` still read `FACILITIES`, `ASHA_WORKERS`, `TREATMENTS` for landing-grid counts | **Deferred** — those two pages were out of the feature-page wiring scope. Trim `data.ts` once Home/Landing are wired. |
| Scheme coverage "reasons" text | Backend returns `benefit`/`docs`, not a free-text reasons array | Adapted: cards show benefit + documents instead. |
| Facility `rating` / `services` / `open24` | Not present in backend | **Removed** (not fabricated). |

---

## 8. How to run / verify locally

```bash
# backend
cd backend && .\.venv\Scripts\python.exe -m pytest tests -q

# frontend
cd "frontend 2.0"
npm install                 # first time only
npx tsc --noEmit            # typecheck
npm run build               # production build
npm run dev                 # dev server (VITE_API_URL points at the API)
```

Backend must be running (`uvicorn app.main:app`). Accounts come from the seed
script (`python -m scripts.seed_data`) or `DEFAULT_*_USERNAME` / `DEFAULT_*_PASSWORD`
env toggles — these are **local-dev-only** defaults; the `prod` guard
(`validate_production_settings`) refuses to start if they are still in place.
