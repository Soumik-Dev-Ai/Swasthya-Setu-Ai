# Swasthya Setu AI — Complete Project Context Document

> **Version:** v2.0.0 | **Platform:** Smart India Hackathon 2026  
> **Repository:** [github.com/Hack-master22/Swasthya-Setu-Ai](https://github.com/Hack-master22/Swasthya-Setu-Ai)

---

## 1. Vision & Mission

**Swasthya Setu AI** ("Bridge to Health") is an offline-first, multimodal, AI-driven healthcare navigation and affordability platform engineered to close the accessibility, data, and financial toxicity gaps in rural India.

It repositions digital health from a standard "Doctor Discovery Marketplace" (e.g., Practo, Ada, Tata 1mg) into an **Integrated Healthcare Affordability and Navigation System**. It answers not merely *"What disease might I have?"*, but critically:

1. **"Am I in immediate danger?"** — Deterministic safety triage with 41 multilingual red-flag keywords.
2. **"Where should I go?"** — Tiered routing: Sub-Centre / Arogya Mandir → PHC → CHC → PM-JAY empaneled hospital.
3. **"What will it actually cost me and how do I afford it?"** — Deterministic Out-of-Pocket Expense (OOPE) math + PM-JAY / PMBJP / AMRIT subsidy matching.

---

## 2. Problem Statements (Field-Validated)

| # | Problem | Data Point |
|---|---------|------------|
| 1 | **Severe public healthcare workforce deficit** | 18.8% doctor vacancy in PHCs; 51.6% specialist vacancy in CHCs |
| 2 | **Dominance of informal healthcare providers** | Non-Degree Allopathic Practitioners (NDAPs) provide 70–77% of rural primary care |
| 3 | **ASHA worker analog burden** | ~1 million ASHA workers burdened by manual paper registers; high transcription errors, physical record loss |
| 4 | **Catastrophic out-of-pocket expenditure** | India's OOPE is 39.4% of Total Health Expenditure; 42.9% goes to retail pharmacy alone (₹1.52 lakh crores in 2021-22) |
| 5 | **PM-JAY fraud and opacity** | NHA levied ₹114 crore penalties across 2,842 hospitals for billing fraud and phantom claims |
| 6 | **Commercial app market failures** | Existing platforms assume high-end smartphones, English fluency, continuous broadband; bypass free public infrastructure entirely |

---

## 3. Target Users & Personas

| Persona | Profile | Core Need |
|---------|---------|-----------|
| **Rural Patient** | Low-to-medium literacy; basic Android (2GB RAM); speaks regional language/dialect; extreme cost sensitivity | "Am I okay, where do I go, and what will it cost me?" |
| **ASHA Worker** | Low-RAM smartphone; overworked with paper forms; target <2-hour onboarding | Rapid photo → OCR → voice-confirmed digital records |
| **Informal Rural Practitioner (NDAP)** | De facto first point of contact in 70%+ rural villages; no formal MD/MBBS | Clinical decision-support checklists to reduce diagnostic errors |
| **Health Official / Administrator** | District/State health departments, NGO partners | Anonymized, aggregated real-time epidemiological surveillance data |

---

## 4. Complete Technical Architecture

### 4.1 Technology Stack

| Domain | Technology | Purpose |
|--------|------------|---------|
| **Frontend** | React 19, Vite 7.3, Tailwind CSS v4 | Compiled to a single hyper-optimized HTML file via `vite-plugin-singlefile` |
| **3D / WebGL** | Three.js, @react-three/fiber | Interactive 3D medical shield, particle network, cinematic warp transitions |
| **Animation** | Framer Motion | Liquid glassmorphism, 3D cursor physics, spring-based comboboxes, page transitions |
| **Mapping** | Pigeon Maps (OpenStreetMap + ArcGIS) | Zero-billing interactive maps with street and satellite tile layers |
| **Backend** | FastAPI, Python 3.12, Uvicorn | Fully asynchronous API with strict Pydantic validation and SlowAPI rate limiting |
| **Database** | SQLAlchemy 2.0 + SQLite (dev) / PostgreSQL (prod) | Zero-setup local DB; instantly scalable via Alembic migrations |
| **AI Routing** | LiteLLM | Unified gateway for Gemini, Groq, and NVIDIA LLM cascades |
| **OSINT** | duckduckgo-search | Medical pricing scraping bounded by strict 3.5s async timeouts |
| **Auth** | python-jose (JWT HS256) + passlib (BCrypt) | Token-based authentication with role enforcement (ASHA / Admin) |
| **Localization** | Custom i18n engine | 9 Indian languages with script-specific font pairing |

### 4.2 Defense-in-Depth Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Requests                        │
│       (React SPA, Offline Mobile, ASHA Field Devices)        │
└──────────────────────────┬──────────────────────────────────┘
                           │
            FastAPI App (main.py)
            ├─ CORSMiddleware (localhost:5173)
            ├─ SlowAPI Limiter (Default: 200/min; Search: 10/min)
            └─ Global Exception Handlers (429 Rate Limit)
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
   V1 Mobile Sync Routers           V2/V3 Engine Router
   (/auth, /asha, /sync, /admin)    (/triage, /cost, /schemes, etc.)
         │                                   │
         ▼                                   ▼
   Deterministic Services          AI Cascade + Safety Layer
   (Auth, Sync, SQLite DB)         (Vision, Pricing, OSINT)
         │                                   │
         │                    ┌──────────────┴──────────────┐
         │                    ▼                              ▼
         │          41-Keyword Safety Layer        Vision & Price LLM Cascade
         │          (ALWAYS overrides AI)          (Gemini → Groq → NVIDIA)
         │                    │                              │
         └────────────────────┼──────────────────────────────┘
                              ▼
               SQLAlchemy Async Database (SQLite / PostgreSQL)
```

---

## 5. AI Model Architecture & Cascades

### 5.1 Vision LLM Triage Cascade

When a patient uploads a medical image (rash, wound, lab report), the system routes it through a **triple-redundant fail-safe cascade**:

| Stage | Provider | Model | Timeout | Fallback |
|-------|----------|-------|---------|----------|
| 1 (Primary) | Google | `gemini-1.5-flash` | 15s | → Stage 2 |
| 2 (Secondary) | Groq | `llama-3.2-90b-vision-preview` | 15s | → Stage 3 |
| 3 (Tertiary) | NVIDIA NIM | `llama-3.1-70b-instruct` | 15s | → Uncertain fallback (conf=0) |

**Critical Design Guarantee:** If ALL three providers fail or timeout, the system returns `confidence: 0` with an `"uncertain"` signal — it **never crashes** and **never blocks** the deterministic safety gate from running on the text symptoms.

### 5.2 Pricing Estimation Cascade

| Priority | Source | Confidence | Tag |
|----------|--------|------------|-----|
| 1 (Highest) | Curated `v2_data.DISEASES` database | 95% | `verified_official_data` |
| 2 | DuckDuckGo web scrape → LLM extraction | Variable | `community_estimate_unverified` |
| 3 (Fallback) | No data available | 0% | `no_estimate_available` |

Web scraping is **gated by `ENABLE_WEB_SCRAPE` (default: OFF)** to comply with AI Ethics Rule 4 (no hallucinated/fabricated pricing).

### 5.3 Deterministic Safety Layer (The Unbreakable Backstop)

This is the single most critical architectural component. It is **100% deterministic** — no LLMs, no ML, no network I/O.

**41 Red-Flag Keywords** across English, Hindi, and Bengali:
- `"chest pain"`, `"difficulty breathing"`, `"unconscious"`, `"stroke"`, `"seizure"`, `"suicidal"`, `"severe bleeding"`, `"anaphylaxis"`, `"snake bite"`, `"heart attack"`, `"cardiac arrest"`, `"no pulse"`, `"blue lips"`, `"cyanosis"`, `"सीने में दर्द"`, `"বুকের ব্যথা"`, and 25 more.

**Enforcement Rules:**
1. If ANY red-flag keyword is detected in text OR frontend safety toggles → **Instant Level 4 Emergency**, regardless of what the AI model says.
2. If the vision model says `"emergency"` but text says `"non_serious"` → **Escalate to Emergency** (fail toward caution).
3. If the vision model says `"non_serious"` but text triggers red flags → **Block the downgrade** and flag `vision_downgrade_blocked: true`.

---

## 6. Complete API Endpoint Reference (15 Endpoints)

| Method | Endpoint | Auth | Rate Limit | Purpose |
|--------|----------|------|------------|---------|
| `GET` | `/health` | None | 200/min | Liveness probe |
| `GET` | `/` | None | 200/min | Root discovery |
| `POST` | `/api/auth/login` | None | 200/min | Issues JWT token (BCrypt verified) |
| `GET` | `/api/auth/me` | Bearer JWT | 200/min | Current user profile |
| `GET` | `/api/admin/analytics` | Admin JWT | 200/min | Aggregated anonymized triage & ASHA statistics |
| `POST` | `/api/asha/upload-form` | ASHA/Admin | 200/min | Medical form OCR digitization |
| `POST` | `/api/asha/records` | ASHA/Admin | 200/min | Create single ASHA health record |
| `GET` | `/api/asha/records` | ASHA/Admin | 200/min | List worker's records (limit 100) |
| `GET` | `/api/asha/emergency-sync` | None | 200/min | Real-time Level-4 emergency case stream |
| `POST` | `/api/sync/batch` | ASHA/Admin | 200/min | Offline mobile batch sync (idempotent upserts) |
| `POST` | `/api/triage/analyze` | None | 200/min | Multimodal vision+text triage with safety gate |
| `POST` | `/api/triage/emergency-route` | None | 200/min | Nearest 24/7 ER hospitals by distance |
| `POST` | `/api/cost/estimate` | None | 200/min | Hospital-specific cost + affordability analysis |
| `POST` | `/api/cost/alternatives` | None | 200/min | Top 3 ranked hospital alternatives |
| `POST` | `/api/insurance/analyze-policy` | None | 200/min | Insurance policy gap audit & risk scoring |
| `POST` | `/api/schemes/match` | None | 200/min | Government scheme eligibility matching |
| `POST` | `/api/facilities/search` | None | 200/min | Facility search with 6-filter engine |
| `POST` | `/api/facilities/advanced-search` | None | **10/min** | Curated pricing + provenance tagging |

---

## 7. Database Schema (6 Tables)

| Table | Key Fields | Purpose |
|-------|------------|---------|
| `users` | `id`, `username` (unique), `hashed_password`, `role` (ASHA/ADMIN), `created_at` | Authentication & role-based access |
| `asha_records` | `worker_id` (FK→users), `record_type`, `structured_fields` (JSON/JSONB), `device_local_id` | ASHA worker health record digitization |
| `facilities` | `name`, `type` (SC/PHC/CHC/PM-JAY/PMBJP), `pm_jay_empaneled`, `lat`, `lng`, `district`, `state` | Healthcare facility registry |
| `pricing` | `facility_id` (FK), `scheme_id` (FK), `procedure_category`, `base_cost`, `subsidized_cost` | Treatment cost and subsidy data |
| `schemes` | `name` (unique), `coverage_rules`, `eligibility_notes` | Government healthcare scheme registry |
| `triage_sessions` | `urgency_tier`, `symptom_category`, `region`, `timestamp`, `device_local_id` | **Zero-PII** anonymized triage audit trail |

---

## 8. Frontend — Complete Feature Inventory

### 8.1 Design System

- **Theme:** Deep abyss dark mode (`#04070d` base) with mint (`#34f5b1`) and cyan (`#4ee6f0`) accent palette.
- **Typography:** Sora (display), Inter (body), Hind/Hind Siliguri/Mandali/Noto Nastaliq Urdu (regional scripts).
- **Surfaces:** Liquid glassmorphism panels with animated radial gradient shifts, SVG turbulence grain textures, and `backdrop-filter: blur(24px)`.
- **Buttons:** Metallic gradient flow buttons with cursor-tracking specular highlights (`--sx`, `--sy` CSS variables).
- **Animations:** Emergency pulse, ring spread, scanline, shimmer, liquid shift, metal flow — all with `prefers-reduced-motion` fallbacks.
- **Accessibility:** Minimum 44×44px touch targets on mobile, 16px input font (prevents iOS auto-zoom), WCAG 2.1 AA contrast, focus traps in modals, keyboard navigation in comboboxes, `aria-live` regions.

### 8.2 Internationalization (9 Languages)

| Language | Script | Font |
|----------|--------|------|
| English | EN | Inter |
| Hindi | हि | Hind |
| Bengali | বাং | Hind Siliguri |
| Telugu | తె | Mandali |
| Urdu | ار | Noto Nastaliq Urdu |
| Marathi | म | Hind |
| Tamil | த | Hind Madurai |
| Kannada | ಕ | Tiro Kannada |
| Gujarati | ગુ | Hind Vadodara |

Over **150 unique UI translation keys** covering branding, navigation, triage workflows, safety checklists, financial inputs, treatment estimates, policy gap reports, scheme finder wizard, facility navigator, and ASHA control room.

### 8.3 Pages & Workflows

#### Landing Page (`/`)
- Full-screen WebGL 3D scene: Interactive medical shield with particle network, orbiting torus ring, and octahedron satellites.
- **Cinematic Warp Transition:** Clicking "Continue" triggers 3D cross scale-up, portal bloom animation, and 820ms fly-through to `/home`.

#### Home Dashboard (`/home`)
- Personalized greeting with active triage level and saved scheme count.
- **3 Live Status Cards:** Insurance coverage, Financial savings rate, ASHA worker assignment.
- **Asymmetric 12-Column Feature Grid:** AI Symptom Detector (7-col), Treatment Cost (5-col), Insurance (4-col), Facility Navigator (5-col), ASHA Desk (3-col).
- **4-Step Patient Journey Timeline:** Safety Checklist → Financial Headroom → Scheme Matching → Facility Navigation.

#### AI Symptom Triage (`/triage`)
- **Inputs:** Age, Sex, Symptom onset duration, City, multilingual symptom text, medical image upload (≤8MB, JPEG/PNG/WebP) with drag-and-drop and consent notice.
- **8-Item Red Flag Safety Checklist:** Chest pain, severe breathlessness, stroke signs, blood in cough/vomit, fainting, pregnancy complications, severe burns, poisoning — each with toggle controls.
- **Output Dashboard:** RingGauge urgency score (L1-L4), matched condition cards, symptom coverage %, model confidence %, clinical advice, vision escalation notices, verified medical citations with URLs, and PrecisionDisclaimer.
- **Emergency Routing:** L4 cases trigger embedded nearest-hospital finder with distance and ETA.
- **Affordability Matching Modal:** Enter household expenses → calculate treatment installments → deep-link to facility map.

#### Treatment Cost (`/cost`)
- **Sub-Tab 1 — Financial Availability:** 8 cash flow inputs (income, housing, food, transport, school, EMI, insurance, other). Dual RingGauge meters for Savings Rate and Disposable Income.
- **Sub-Tab 2 — Treatment Benchmarks:** 10 benchmark diseases, 4 severity tiers, city-wise and hospital-specific pricing. Expandable 4-stage breakdown: OPD consultation → Inpatient → Surgery → Rehabilitation.

#### Insurance & Schemes (`/insurance`)
- **Sub-Tab 1 — Policy Checker:** Searchable provider dropdown, plan name, policy type, sum insured, policy number. Outputs: Risk Score RingGauge, in-network hospital count, critical coverage gaps, claim rejection risks, step-by-step recommendations.
- **Sub-Tab 2 — 5-Step Scheme Wizard:** State → Income bracket → Social category → Employment type → Healthcare need. Returns ranked government schemes with match %, benefit details, required documents, and save/bookmark.

#### Facility Navigator (`/facilities`)
- **Sidebar:** Text search, city selector, sort (distance/cost/quality), 6 capability toggles (PM-JAY, 24/7 ER, ICU, Blood Bank, NABH, >500 Beds).
- **Results List:** Quality score badges, distance in km, traffic-adjusted travel ETA, insurance acceptance banner, verified price badges.
- **Dual Map:** Interactive Pigeon Maps (OpenStreetMap street + ArcGIS satellite) with custom markers, popup overlays, and Google Maps directions links. Schematic SVG vector fallback with animated dash-flow route lines.

#### ASHA Control Room (`/asha`)
- **Public Mode:** Directory of 5 ASHA workers with experience, languages, contact badges. Worker sign-in and self-registration modals.
- **Authenticated Mode:** Live statistics dashboard (patients, emergencies, follow-ups). Community patient registration form. Emergency Action Board with real-time sync, pulsing alerts, embedded SVG route maps with distance/ETA, and "Accept and Dispatch" workflow.

### 8.4 Reusable Component Library

| Component | Features |
|-----------|----------|
| `Glass` | Liquid glassmorphism container with animated radial gradients and grain texture |
| `Btn` | Magnetic spring button with metallic gradient flow and cursor-tracking specular highlight |
| `SearchSelect` | Accessible combobox with keyboard navigation, search filter, spring animations |
| `RingGauge` | Circular SVG progress meter with animated stroke offset and center percentage |
| `Cursor3D` | Physics-driven 3D cursor portal with magnetic attraction to interactive elements |
| `MapView` | Pigeon Maps with OSM/ArcGIS tiles, markers, popup overlays, graceful tile-load failure |
| `Modal` | Accessible dialog with 3D perspective flip animation, full focus trap, Escape key closing |
| `SlideTabs` | 3D magnetic desktop navigation with sliding background capsule |
| `HeroScene` | Three.js WebGL canvas with 200-particle network, extruded medical cross, orbiting satellites |
| `PriceBadge` | Trust badge: verified official / community estimate / price on request |
| `Aurora` | GPU-composited 3-point breathing ambient light field |

---

## 9. Static Data Assets

### 9.1 Cities (7 Metros)
Delhi, Mumbai, Kolkata, Bhopal, Ranchi, Patna, Jaipur — each with exact coordinates, price index (0.78–1.18), and traffic multiplier (0.85–1.4).

### 9.2 Hospitals (16 Verified Facilities)
AIIMS New Delhi (2478 beds, score 96), Apollo Indraprastha (710 beds), Safdarjung Hospital (1600 beds), Kokilaben Mumbai (750 beds), KEM Mumbai (1800 beds), SSKM Kolkata (1700 beds), AIIMS Bhopal (960 beds), RIMS Ranchi (980 beds), AIIMS Patna (980 beds), SMS Jaipur (1760 beds), and 6 more — all with tier, quality score, bed count, ICU, 24/7 ER, PM-JAY empanelment, NABH accreditation, blood bank, price index, and exact lat/lon.

### 9.3 Diseases (10 Benchmark Procedures)
| Disease | Base Cost [Mild → Critical] | Care Stages (OPD, IPD, Proc, Rehab days) |
|---------|----------------------------|------------------------------------------|
| Dengue | ₹18k → ₹2.2L | 2, 5, 0, 7 |
| Typhoid | ₹9k → ₹1.2L | 2, 4, 0, 6 |
| Pneumonia | ₹20k → ₹2.4L | 2, 6, 0, 10 |
| Cataract Surgery | ₹14k → ₹42k | 1, 1, 1, 14 |
| Knee Replacement | ₹2.2L → ₹3.2L | 2, 5, 1, 42 |
| Heart Bypass (CABG) | ₹1.8L → ₹3.4L | 2, 8, 1, 30 |
| Normal Delivery | ₹12k → ₹1.2L | 3, 2, 1, 14 |
| Dialysis (Monthly) | ₹30k → ₹1.2L | 8, 0, 8, 0 |
| Stroke Management | ₹1.6L → ₹5.2L | 1, 10, 1, 60 |
| COVID-19 Care | ₹15k → ₹2.3L | 2, 7, 0, 14 |

### 9.4 Government Schemes (8 Schemes with Deterministic Matchers)
PM-JAY (₹5L hospitalization), CGHS, ESIC, JSY (maternal), PMNDP (free dialysis), HMDG (₹1.25L critical illness grant), Chiranjeevi (Rajasthan ₹25L), WBHS (West Bengal).

### 9.5 Insurance Providers (6)
PM-JAY (Ayushman Bharat), SBI General Health, HDFC Ergo Health, Star Health, ICICI Lombard, Niva Bupa.

### 9.6 Triage Conditions (17 Diagnostic Categories)
Dengue (L3), Typhoid (L3), COVID-19 (L2), Pneumonia (L4), Influenza (L2), Gastroenteritis (L2), Migraine (L1), UTI (L2), Asthma exacerbation (L4), Severe dengue warning (L4), Cardiac chest pain (L4), Gastritis (L1), Back pain (L1), Anaemia (L2), Uncontrolled diabetes (L3), Skin infection (L1), Eye infection (L1). Each with multilingual keywords (English, Hindi, Bengali) and clinical guidance.

---

## 10. AI Ethics & Safety Guardrails

### 10.1 Ten Foundational AI Principles

1. **Decision Support, Never Diagnostic Authority** — Triage urgency and routing only; never named disease diagnosis.
2. **Deterministic Safety Overrides Probabilistic Intelligence** — Hardcoded clinical checklists always override AI confidence.
3. **Low-Resource-First Design** — Benchmarkable against 2GB RAM / <100MB.
4. **Linguistic & Literacy Equity** — Voice-first, regional language native, usable by non-literate individuals.
5. **Privacy by Design** — On-device processing target, zero unconsented PII transmission.
6. **Affordability-Aware** — Recommendations always include cost transparency and scheme pathways.
7. **Transparency & Explainability** — Plain-language reasoning for every recommendation.
8. **Human-in-the-Loop** — Clinicians and ASHA workers confirm all critical records.
9. **Continuous Field-Grounded Validation** — Clinical guidelines (WHO IMCI, IPHS) over raw accuracy.
10. **Fail Safe, Not Fail Silent** — Ambiguity defaults to conservative safe tier (`CONSULT_SOON`).

### 10.2 Hard Non-Negotiable Restrictions

- ❌ No named medical diagnoses (e.g., "you have pneumonia").
- ❌ No medication names, dosages, or prescriptions.
- ❌ No downgrading or suppressing an emergency classification.
- ❌ No hallucinating/fabricating facility, pricing, or scheme details.
- ❌ No data retention beyond active session without explicit consent.
- ✅ Clear "decision support, not medical substitute" disclaimers on every screen.

---

## 11. Security & Resilience Architecture

| Concern | Solution | Mechanism |
|---------|----------|-----------|
| **SQL Injection** | Pydantic `SafeId` regex | `^[A-Za-z0-9_.-]{1,64}$` — rejects malicious identifiers at schema layer (HTTP 422) |
| **Payload Poisoning** | Strict Pydantic typing | Giant strings, nested JSON, malformed bodies → HTTP 422, never 500 |
| **Rate Limit Abuse** | SlowAPI token-bucket | 200/min default; 10/min on advanced search per IP |
| **API Key Exhaustion** | Triple LLM cascade | Gemini → Groq → NVIDIA; graceful `uncertain` fallback if all fail |
| **Network Blackout** | Client-side data fallback | Frontend filters local `HOSPITALS` dataset if backend is offline |
| **Map Tile Failure** | Pigeon Maps error handler | Styled SVG fallback overlay without crashing React tree |
| **iOS Auto-Zoom** | CSS enforcement | All inputs at 16px minimum to prevent Safari forced viewport zoom |
| **Mobile Sync Retransmission** | Idempotent upserts | Composite deduplication keys `(worker_id, device_local_id)` — zero duplicate rows |
| **Auth** | JWT HS256 + BCrypt | 24-hour token expiry; role-based route guards (ASHA / ADMIN) |

---

## 12. Responsive Design & Mobile Optimization

- All grids collapse from multi-column to single-column via Tailwind breakpoints (`sm:`, `md:`, `lg:`).
- Header converts horizontal tabs to hamburger drawer menu on mobile.
- Map dynamically scales from 400px (mobile) to 520px (desktop).
- Minimum 44×44px touch targets enforced via CSS `@media (max-width: 768px)`.
- Heading typography scales via `clamp()` functions.
- All continuous animations disabled under `prefers-reduced-motion: reduce`.

---

## 13. Deployment Architecture

| Component | Platform | Configuration |
|-----------|----------|---------------|
| **Frontend** | Vercel | Root: `frontend/`, Build: `npm run build`, Output: `dist/`, Env: `VITE_API_BASE_URL` |
| **Backend** | Render | Build: `pip install -r requirements.txt`, Start: `uvicorn app.main:app --host 0.0.0.0 --port 10000` |
| **Database** | Neon.tech (Free PostgreSQL) or Ephemeral SQLite | `DATABASE_URL=postgresql+asyncpg://...` for persistence |

---

## 14. Roadmap

| Phase | Milestone |
|-------|-----------|
| **Phase 0** | Research & Definition (✅ Complete) |
| **Phase 1** | Web Prototype MVP (✅ Complete — Current State) |
| **Phase 2** | Clinical Mentor Review & Refinement |
| **Phase 3** | React Native Mobile App (SQLite/Room, AES-256, WorkManager Sync, ASHA Kiosk Mode) |
| **Phase 4** | On-Device Edge AI (Gemma 3n 4B multimodal on ONNX Runtime Mobile) |
| **Phase 5** | Adherence Nudges (SMS/WhatsApp Gateway) & Financial Literacy USSD/Chatbot |
| **Phase 6** | Government & NGO Scale (ABDM interoperability, national dataset expansion) |

---

## 15. Official Data Sources

1. **PM-JAY Health Benefit Packages (HBPs)** — `pmjay.gov.in`
2. **SECC 2011 Database & Beneficiary Portal** — `beneficiary.nha.gov.in`
3. **PMBJP Product List & Prices** — `pmbi.co.in`
4. **National List of Essential Medicines (NLEM) 2022** — `nppa.gov.in` (384 price-capped drugs)
5. **NHA HEM & HFR** — `hospitals.pmjay.gov.in`, `nhpr.abdm.gov.in`
6. **Kaggle Symptom-Disease Datasets** — relabeled to urgency tiers
7. **SNOMED CT India Drug Extension** — `nrces.in`
8. **AI4Bharat (IIT Madras)** — IndicBERT / IndicTrans2 / IndicVoices / Vaani datasets
9. **WHO IMCI Guidelines** — Pediatric clinical triage protocol grounding

---

## 16. Key Differentiators vs. Existing Solutions

| Feature | Practo / 1mg / eSanjeevani | **Swasthya Setu AI** |
|---------|---------------------------|---------------------|
| Cost Transparency | ❌ Hidden / "Contact for pricing" | ✅ Deterministic OOPE calculator with scheme deductions |
| Public Infrastructure Routing | ❌ Private hospitals only | ✅ Routes to free PHCs, CHCs, Jan Aushadhi pharmacies |
| Offline Functionality | ❌ Requires broadband | ✅ Client-side data fallback + WorkManager sync |
| Regional Language Support | ⚠️ Limited (2-3 languages) | ✅ 9 Indian languages with native script fonts |
| AI Safety Architecture | ⚠️ Single model, no safety gate | ✅ Triple LLM cascade + 41-keyword deterministic override |
| ASHA Worker Integration | ❌ None | ✅ Full control room with emergency dispatch |
| Financial Profiling | ❌ None | ✅ 8-field cash flow model with affordability % |
| Government Scheme Matching | ❌ None | ✅ 8 schemes with deterministic eligibility matchers |
