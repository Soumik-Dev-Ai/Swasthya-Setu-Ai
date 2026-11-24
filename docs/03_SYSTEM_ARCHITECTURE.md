# Document 2 — System Architecture Document
**Status key:** 🟢 EXISTING · 🟡 EXTEND · 🔴 NEW

---

## 1. High-Level Architecture

```mermaid
flowchart TD
    subgraph Client["Client Layer 🟢"]
        A[React SPA / PWA<br/>offline cache + local SQLite mirror]
        B[ASHA Field App Mode]
    end

    subgraph API["FastAPI App (main.py) 🟢"]
        C[CORS + SlowAPI Limiter<br/>200/min default, 10/min search]
        D[Global Exception Handlers]
    end

    subgraph V1["V1 Mobile Sync Routers 🟢"]
        E["/auth"]
        F["/asha"]
        G["/sync"]
        H["/admin"]
    end

    subgraph V2["V2/V3 Engine Router 🟢🔴"]
        IC{Intent Classifier 🔴 NEW<br/>see 16_INTENT_ROUTING...md}
        I["/triage 🟢"]
        J["/cost 🟢"]
        K["/schemes 🟢"]
        L["/patients 🔴 NEW"]
        M["/referrals 🔴 NEW"]
        N["/dashboard 🔴 NEW"]
    end

    subgraph Safety["Deterministic Safety Layer 🟢"]
        O[41-Keyword Scanner<br/>ALWAYS runs first, zero I/O]
    end

    subgraph Knowledge["Knowledge Engine 🔴 NEW — see 15_AI_STRATEGY_UNIFIED.md"]
        RAG[RAG: WHO IMCI/ETAT retrieval<br/>pgvector on Neon]
        LOOKUP[Deterministic Lookup: pricing + schemes<br/>NOT part of RAG — see doc 15 §4]
    end

    subgraph Reasoning["Reasoning Engine 🟢🔴"]
        P[Online Backend: Gemini → Groq → NVIDIA NIM<br/>few-shot structured reasoning 🟢]
        P2[Offline Backend: LoRA-tuned MedGemma edge model<br/>on-device retrieval store 🔴 NEW]
    end

    subgraph Verify["Grounding Verifier 🔴 NEW"]
        GV[Mechanical citation check]
    end

    subgraph DB["SQLAlchemy Async DB 🟢🔴"]
        R[(SQLite dev / PostgreSQL prod)]
    end

    A --> C
    B --> C
    C --> V1
    C --> V2
    I --> O
    O -->|no red flag, clinical| RAG
    O -->|no red flag, cost/scheme| LOOKUP
    O -->|red flag| I
    RAG --> P
    RAG --> P2
    P --> GV
    P2 --> GV
    LOOKUP --> J
    E & F & G & H --> R
    I & J & K & L & M & N --> R
```

## 2. Technology Stack Selection

| Layer | Technology | Version | Why chosen (vs. alternatives) |
|---|---|---|---|
| Frontend | React | 19 | Team's existing expertise; concurrent rendering suits offline-sync UI states over Vue/Svelte, which would require a rewrite |
| Build tool | Vite | 7.3 | `vite-plugin-singlefile` compiles to one HTML file — critical for the <100MB, low-RAM device constraint; Webpack's bundle splitting works against this goal |
| Styling | Tailwind CSS | v4 | Zero runtime CSS-in-JS overhead, smaller bundle than styled-components |
| 3D/visual | Three.js + @react-three/fiber | latest stable | Already integrated for the shield/particle-network hero visuals; free, MIT-licensed |
| Animation | Framer Motion | latest stable | Free; used for glassmorphism transitions already built |
| Mapping | Pigeon Maps + OpenStreetMap/ArcGIS tiles | latest | **Zero billing** — Google Maps Platform would violate the free-tier constraint outright |
| Backend | FastAPI + Uvicorn | Python 3.12 | Async-native (needed for the 3-stage LLM cascade with per-stage timeouts), automatic OpenAPI docs, Pydantic validation built in |
| ORM | SQLAlchemy 2.0 (async) + Alembic | latest stable | SQLite for zero-setup dev, drop-in PostgreSQL for prod via the same models; Alembic gives us safe migrations for the FR-9/FR-10 new tables |
| Database (dev) | SQLite | 3.x | Zero infra, matches the offline-first philosophy for the client-side mirror too |
| Database (prod) | PostgreSQL (Neon.tech free tier) | 16 | Free serverless Postgres with a generous free storage/compute allowance; scales the ORM models unchanged |
| AI gateway | LiteLLM | latest | Single interface across Gemini / Groq / NVIDIA NIM — swapping cascade order or adding a 4th provider is a config change, not a rewrite |
| Auth | python-jose (JWT HS256) + passlib (BCrypt) | latest | Industry-standard, free, no external auth-as-a-service billing |
| i18n | Custom engine | — | Off-the-shelf i18n libraries add bundle weight disproportionate to a <100MB target; a custom key-value + script-font-pairing engine keeps this lean |
| Deployment (frontend) | Vercel (free tier) | — | Zero-config static hosting for the single-file build |
| Deployment (backend) | Render (free tier) | — | Free web service tier for FastAPI + Uvicorn |
| Deployment (DB) | Neon.tech (free tier) | — | Serverless Postgres, no card required on free tier |

## 3. Module Decomposition

| Module | Status | Responsibility | Input → Output | Depends on | Offline capability |
|---|---|---|---|---|---|
| **Safety Gate** | 🟢 | Deterministic red-flag detection, always runs first | Raw symptom text/lang → urgency override (or pass-through) | None (zero I/O by design) | Full — no network, no LLM |
| **Intent Classifier** | 🔴 NEW | Routes input to the Symptom and/or Financial pipeline — never bypasses the Safety Gate | Raw input → `{intent, confidence, method}` | None for deterministic pass; LLM cascade for ambiguous fallback | Deterministic pass works fully offline |
| **Government Financial ETL Pipeline** | 🔴 NEW | Scheduled (quarterly), offline, mechanically-verified, human-signed-off refresh of the cost/scheme lookup tables from government-only sources | Official government documents → verified, versioned DB rows | LLM-assisted extraction (offline), mechanical grounding verifier | N/A — background process, not a request-time path |
| **Triage Engine** | 🟢 | Combines safety-gate result + LLM cascade into a final urgency tier | Symptoms/image → `{tier, confidence, source}` | Safety Gate, AI Cascade | Text-only triage works fully offline; image triage needs network |
| **AI Cascade (Vision + Pricing)** | 🟢 | 3-stage provider fallback for both vision analysis and price lookups | Query → provider response or `uncertain` | LiteLLM gateway | No — requires network; must fail gracefully |
| **Cost Analyzer** | 🟢 | OOPE calculation against curated disease DB + scheme deduction | Disease + hospital + funding route → itemized cost | Scheme Matcher, Facility DB | Full — curated DB is local |
| **Scheme Matcher** | 🟢 | Deterministic eligibility check against 8 schemes | Demographic input → eligible scheme list | None | Full |
| **Facility Router** | 🟢 | Recommends tier-appropriate facility | Urgency + location + funding → ranked facility list | Facility DB | Full — client-side dataset fallback |
| **ASHA Sync** | 🟢 | Offline field-record capture + idempotent sync | Photo/voice input → queued record → synced record | Auth, DB | Full capture offline; sync requires network |
| **Auth & Roles** | 🟢 | JWT issuance, role enforcement | Credentials → token; token → route access | DB | Login requires network; cached token works offline for read-only views |
| **Patient Record** | 🔴 NEW | Persistent longitudinal timeline per patient | New event (triage/referral/visit) → appended `patient_events` row | DB, Auth | Writes queue offline like ASHA Sync; reads need last-synced snapshot |
| **Referral Tracker** | 🔴 NEW | Creates/updates referral status across tiers | Routing escalation → `referral` record; status update → notify sending/receiving facility | Patient Record, Facility DB | Status updates queue offline |
| **Follow-up Engine** | 🔴 NEW | Scheduled job flags overdue high-risk follow-ups | Cron tick + `patient_events` → worklist entries | Patient Record | Requires the backend process to be online to run the scheduler; worklist itself is readable offline once synced |
| **Dashboard Aggregator** | 🔴 NEW | Pre-computes facility/district-level aggregates | Raw event tables → cached aggregate rows | Patient Record, Referral Tracker | Read-only, cache-served — no offline write path needed |
| **FHIR Export** | 🔴 NEW | Shapes internal records into FHIR India Core JSON | Patient/referral record → FHIR-shaped JSON | Patient Record | N/A — export-only, on-demand |

## 4. Data Flow — 3 Critical Workflows

### 4.1 Symptom Triage (🟢 existing, unchanged)
```mermaid
sequenceDiagram
    participant U as User (Meena)
    participant C as Client
    participant S as Safety Gate
    participant AI as Vision/LLM Cascade
    participant D as DB

    U->>C: Enters symptoms (voice, Hindi)
    C->>S: POST /v2/triage {text, lang}
    S->>S: Scan 41 keywords (local, <200ms)
    alt Red flag matched
        S-->>C: {tier: L4, source: "deterministic"}
    else No red flag
        S->>AI: Forward to LLM cascade
        AI-->>S: {tier, confidence} or uncertain
        S-->>C: Final tier (AI cannot override a flag that WAS matched)
    end
    C->>D: Log triage event (async, non-blocking)
```

### 4.2 Cost Estimation (🟢 existing, unchanged)
```
User selects disease + hospital type + funding route
  → POST /v2/cost {disease_id, hospital_tier, funding_route, demographic_data}
  → Scheme Matcher checks PM-JAY/CGHS/etc. eligibility (deterministic)
  → Cost Analyzer pulls base cost from curated DISEASES DB (95% confidence)
     [fallback: DuckDuckGo scrape → LLM extraction, only if ENABLE_WEB_SCRAPE=true]
  → Response: {estimated_cost, confidence, scheme_applied, breakdown[]}
```

### 4.3 Referral Creation & Tracking (🔴 NEW)
```mermaid
sequenceDiagram
    participant ASHA as ASHA (Radha)
    participant API as /referrals
    participant PR as Patient Record
    participant PHC as PHC Dashboard (Dr. Verma)

    ASHA->>API: POST /referrals {patient_id, from_facility, to_facility, urgency}
    API->>PR: Append patient_events row {type: "referral_created"}
    API-->>ASHA: {referral_id, status: "pending"}
    Note over API,PHC: When patient arrives (or ASHA/receiving facility updates status)
    PHC->>API: PATCH /referrals/{id} {status: "arrived"}
    API->>PR: Append patient_events row {type: "referral_status_change"}
    API-->>PHC: Updated referral visible on dashboard aggregate
```

## 5. AI/ML Pipeline Architecture

**Full architecture and rationale: `15_AI_STRATEGY_UNIFIED.md`.** Summary:

- **Knowledge Engine (RAG):** clinical/triage queries only — retrieves WHO IMCI/ETAT guideline chunks via pgvector-on-Neon (`14_RAG_SYSTEM_DESIGN.md`). Cost/scheme queries do **not** go through RAG — they hit the deterministic `v2_data.DISEASES` lookup and rule engine directly, unchanged from the original design, because a lookup is a stronger guarantee than a grounded generation step (`15_AI_STRATEGY_UNIFIED.md` §4).
- **Reasoning Engine, online backend:** Gemini `gemini-1.5-flash` (15s timeout) → Groq `llama-3.2-90b-vision-preview` (15s) → NVIDIA NIM `llama-3.1-70b-instruct` (15s) → if all fail, `{confidence: 0, status: "uncertain"}`. Reasons only over Knowledge-Engine-retrieved context, using few-shot structured exemplars in place of fine-tuning (not available on any free tier at this model scale).
- **Reasoning Engine, offline backend:** LoRA-tuned MedGemma edge model (`13_FINE_TUNING_TRAINING_PLAN.md`), paired with its own on-device retrieval store since it can't reach the Neon-hosted vector store when actually offline.
- **Grounding verification:** every Reasoning Engine output's citation is mechanically checked against the chunk it claims to cite before display (`12_AI_RELIABILITY_HARDENING_PLAN.md`, `14_RAG_SYSTEM_DESIGN.md` §5). Failure falls through the cascade, never to an unverified guess.
- **Training data sources:** see `07_DATA_CATALOG.md` — all free, public, no institutional gatekeeping.
- **Fallback strategy:** every AI-dependent module has a deterministic or "uncertain, never crash" floor. No user-facing flow ever hard-fails because an LLM provider is down.
- **Safety layer design:** see `04_AI_SAFETY_ETHICS.md` for the full ruleset — it is intentionally **not part of the AI pipeline**; it sits upstream of both the Knowledge and Reasoning Engines and neither can influence it.

## 6. Database Schema

### 6.1 Existing tables 🟢 (abbreviated to relevant columns)
| Table | Key columns | Notes |
|---|---|---|
| `users` | `id`, `phone_hash`, `role` (ASHA/ADMIN), `password_hash`, `created_at` | `phone_hash`, not raw phone, per NFR-6 |
| `hospitals` | `id`, `name`, `tier`, `lat`, `lon`, `bed_count`, `icu`, `pmjay_empaneled` (bool), `nabh_accredited` (bool), `quality_score`, `price_index` | 16 seeded rows |
| `diseases` | `id`, `name`, `cost_mild`, `cost_critical`, `opd_days`, `ipd_days`, `procedure_days`, `rehab_days` | 10 seeded rows |
| `schemes` | `id`, `name`, `max_coverage`, `eligibility_rule` (JSON) | 8 seeded rows |
| `triage_events` | `id`, `user_id`, `symptoms_text`, `tier`, `source` (deterministic/AI), `created_at` | |
| `asha_sync_queue` | `id`, `worker_id`, `device_local_id` (composite unique key), `payload` (JSON), `synced_at` | Idempotency key: `(worker_id, device_local_id)` |

### 6.2 New tables 🔴 (required for FR-9, FR-10, FR-11, FR-13)

```sql
-- FR-9: Longitudinal patient record
CREATE TABLE patient_records (
    id             UUID PRIMARY KEY,
    demographic_hash VARCHAR(128) NOT NULL,  -- phone + DOB hash, NOT Aadhaar
    display_name   VARCHAR(120),
    age_band       VARCHAR(20),
    risk_flags     JSONB,                    -- e.g. {"maternal": true, "chronic": ["diabetes"]}
    created_at     TIMESTAMPTZ DEFAULT now(),
    UNIQUE (demographic_hash)
);

CREATE TABLE patient_events (
    id             UUID PRIMARY KEY,
    patient_id     UUID REFERENCES patient_records(id),
    event_type     VARCHAR(40) NOT NULL,     -- triage | referral_created | referral_status_change | visit | follow_up_due
    facility_id    INT REFERENCES hospitals(id),
    payload        JSONB,
    created_by     UUID REFERENCES users(id),
    created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_patient_events_patient ON patient_events(patient_id, created_at);

-- FR-10: Referral tracking
CREATE TABLE referrals (
    id             UUID PRIMARY KEY,
    patient_id     UUID REFERENCES patient_records(id),
    from_facility_id INT REFERENCES hospitals(id),
    to_facility_id   INT REFERENCES hospitals(id),
    urgency_tier   VARCHAR(4) NOT NULL,       -- L1-L4
    status         VARCHAR(20) DEFAULT 'pending', -- pending | in_transit | arrived | completed | lost
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now()
);

-- FR-11: Follow-up worklist (materialized by the scheduled job, not a live view)
CREATE TABLE follow_up_worklist (
    id             UUID PRIMARY KEY,
    patient_id     UUID REFERENCES patient_records(id),
    reason         VARCHAR(60),               -- maternal | child_immunization | chronic_recall
    due_date       DATE NOT NULL,
    resolved       BOOLEAN DEFAULT false,
    assigned_worker_id UUID REFERENCES users(id)
);

-- FR-12: Facility capacity snapshot (explicitly non-live)
CREATE TABLE facility_capacity_snapshot (
    id             UUID PRIMARY KEY,
    facility_id    INT REFERENCES hospitals(id),
    diagnostic_capacity JSONB,                -- e.g. {"x_ray": true, "usg": false}
    medicine_stock JSONB,
    snapshot_taken_at TIMESTAMPTZ NOT NULL,    -- surfaced in UI as "last updated"
    source         VARCHAR(60)                 -- e.g. "NHA HFR public directory, manual entry"
);
```

## 7. API Contract Specification

| Method | Path | Auth | Request | Response | Rate limit |
|---|---|---|---|---|---|
| POST | `/v1/auth/login` | none | `{phone_hash, password}` | `{token, role, expires_at}` | 200/min |
| POST | `/v1/asha/records` | ASHA | `{device_local_id, payload}` | `{status: "queued"}` | 200/min |
| POST | `/v1/sync` | ASHA | `{records: [...]}` (batch) | `{synced: n, duplicates_skipped: n}` | 200/min |
| GET | `/v1/admin/overview` | ADMIN | — | Aggregate summary | 200/min |
| POST | `/v2/triage` | none/ASHA | `{text?, image?, lang}` | `{tier, confidence, source, vision_downgrade_blocked}` | 200/min |
| POST | `/v2/cost` | none/ASHA | `{disease_id, hospital_tier, funding_route, demographics?}` | `{estimated_cost, confidence, scheme_applied, breakdown[]}` | 200/min |
| GET | `/v2/schemes/eligibility` | none/ASHA | query params: income, category, state | `{eligible: [scheme_ids]}` | 200/min |
| GET | `/v2/facilities/search` | none | query params: lat, lon, tier, pmjay_only | `{facilities: [...]}` | 10/min |
| POST | `/v3/patients` 🔴 | ASHA | `{demographic_hash, display_name?, age_band, risk_flags?}` | `{patient_id}` | 200/min |
| GET | `/v3/patients/{id}/timeline` 🔴 | ASHA/ADMIN | — | `{events: [...]}` | 200/min |
| POST | `/v3/referrals` 🔴 | ASHA | `{patient_id, from_facility_id, to_facility_id, urgency_tier}` | `{referral_id, status}` | 200/min |
| PATCH | `/v3/referrals/{id}` 🔴 | ASHA/ADMIN | `{status}` | `{referral_id, status, updated_at}` | 200/min |
| GET | `/v3/dashboard/district` 🔴 | ADMIN | query: district_id | `{triage_volume_by_tier, referral_completion_rate, follow_up_backlog}` | 10/min |
| GET | `/v3/patients/{id}/fhir` 🔴 | ADMIN | — | FHIR India Core JSON | 10/min |

**Error codes:** `400` malformed request · `401` missing/invalid token · `403` role mismatch · `404` resource not found · `422` Pydantic validation failure (never `500` for bad input — see `04_AI_SAFETY_ETHICS.md`/security notes) · `429` rate limit exceeded.

## 8. Security Architecture

- **AuthN:** JWT (HS256), 24h expiry, issued on `/v1/auth/login`.
- **AuthZ:** Role guard middleware on every route in `/v1/admin/*` and any `ADMIN`-only `/v3` route; `ASHA` role required on all write endpoints.
- **Input sanitization:** Pydantic `SafeId` regex `^[A-Za-z0-9_.-]{1,64}$` on all identifier fields; strict typing rejects oversized/malformed payloads at the schema layer with HTTP 422.
- **Encryption:** AES-256 for any device-local cached PII (ASHA queue, patient record cache); TLS in transit (enforced by Vercel/Render free-tier defaults).
- **Rate limiting:** SlowAPI token-bucket, 200/min default, 10/min on search- and dashboard-heavy endpoints.
- **Idempotency:** composite `(worker_id, device_local_id)` key prevents duplicate writes on retransmission.

## 9. Deployment Architecture

```
Frontend (Vercel, free)         Backend (Render, free)              DB (Neon.tech, free Postgres)
  root: frontend/                 build: pip install -r req.txt        DATABASE_URL=postgresql+asyncpg://...
  build: npm run build            start: uvicorn app.main:app          used in prod; SQLite for local dev
  output: dist/                   --host 0.0.0.0 --port 10000
  env: VITE_API_BASE_URL   ---->  (points at Render URL)         ---->
```

**Known free-tier limitations to disclose honestly in the demo, not discover on stage:** Render's free web service sleeps after inactivity (cold-start delay on first request) and Neon's free tier caps storage/compute — fine for a hackathon demo and small pilot, not for production scale (see `08_ROADMAP_EXECUTION_PLAN.md` risk register).

## 10. Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ triage_events : creates
    users ||--o{ asha_sync_queue : submits
    users ||--o{ patient_events : records
    patient_records ||--o{ patient_events : has
    patient_records ||--o{ referrals : subject_of
    patient_records ||--o{ follow_up_worklist : has
    hospitals ||--o{ referrals : from_facility
    hospitals ||--o{ referrals : to_facility
    hospitals ||--o{ facility_capacity_snapshot : has
    hospitals ||--o{ patient_events : located_at
    triage_events ||--o{ safety_override_log : may_produce
    diseases ||--o{ triage_events : classified_as
    schemes ||--o{ patient_events : referenced_in
```

## 11. Authorization Matrix

| Route group | Anonymous | ASHA | ADMIN |
|---|---|---|---|
| `/v2/triage`, `/v2/cost`, `/v2/schemes/eligibility`, `/v2/facilities/search` | ✅ | ✅ | ✅ |
| `/v1/asha/*`, `/v3/patients/*`, `/v3/referrals/*` | ❌ | ✅ | ✅ |
| `/v1/admin/*`, `/v3/dashboard/*`, `/v3/patients/{id}/fhir` | ❌ | ❌ | ✅ |
| Right to erasure request (DPDP) | N/A | Can request for own-recorded patients | Can action any erasure request |

## 12. CORS Policy

```python
# Explicit allow-list — replaces the old implicit/permissive policy (see 01_AUDIT_KEEP_KILL.md #7)
ALLOWED_ORIGINS = [
    "https://swasthyasetu.vercel.app",   # production frontend
    "http://localhost:5173",              # Vite local dev
]
# No wildcard "*" origin in any environment, including demo — the demo origin
# is known in advance and should be added to this list explicitly, not bypassed.
```

## 13. Environment Variable Catalog

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Postgres connection string (prod) or SQLite path (dev) | `postgresql+asyncpg://user:pass@host/db` |
| `JWT_SECRET` | HS256 signing secret | (generated, never committed) |
| `JWT_REFRESH_SECRET` | Separate secret for refresh tokens (fixes 01_AUDIT #9) | (generated, never committed) |
| `GEMINI_API_KEY` | Google AI Studio free-tier key | (secret) |
| `GROQ_API_KEY` | Groq free-tier key | (secret) |
| `NVIDIA_NIM_API_KEY` | NVIDIA NIM free-tier key | (secret) |
| `ENABLE_WEB_SCRAPE` | Feature flag for the cost-estimate scrape fallback | `false` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allow-list | `https://swasthyasetu.vercel.app` |
| `VITE_API_BASE_URL` | Frontend build-time backend URL | `https://swasthyasetu-api.onrender.com` |
| `RATE_LIMIT_DEFAULT` | Requests/min default tier | `200` |
| `RATE_LIMIT_SEARCH` | Requests/min for search/dashboard endpoints | `10` |

## 14. Local Development Setup

```bash
# Backend
git clone <repo> && cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in keys from §13 above
alembic upgrade head
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## 15. CI/CD Pipeline (GitHub Actions, free tier)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  safety-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r backend/requirements.txt
      # This job MUST pass before anything else runs — a failing safety
      # test blocks the entire pipeline, per 01_AUDIT_KEEP_KILL.md #4.
      - run: pytest backend/tests/test_safety_layer.py -v --strict
  backend-tests:
    needs: safety-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r backend/requirements.txt
      - run: pytest backend/tests/ -v
  frontend-build:
    needs: safety-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd frontend && npm ci && npm run build && npm run test
```
Deployment itself stays on Vercel/Render's native git-push auto-deploy (both free-tier, both zero-config) — GitHub Actions here is purely the test gate, not the deployer, so no paid CI minutes are needed beyond GitHub's free public-repo allowance.

## 16. Cache Strategy (AI Pipeline)

| Cache | Key | TTL | Eviction |
|---|---|---|---|
| Facility search results | `facility_search:{lat_rounded}:{lon_rounded}:{tier}` | 1 hour | LRU, in-memory (Python `functools.lru_cache` or equivalent) — no Redis needed at this scale |
| Cost-estimate curated-DB lookups | `cost:{disease_id}:{hospital_tier}:{funding_route}` | 24 hours (static data rarely changes) | Time-based only |
| Dashboard aggregates (FR-13) | `dashboard:{district_id}:{date}` | 15 minutes, manual-refresh overrides | Time-based |
| Vision cascade results | **Not cached** — every triage image is patient-specific; caching would be both useless and a privacy risk | — | — |
