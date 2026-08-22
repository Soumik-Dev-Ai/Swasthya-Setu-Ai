# System Architecture Document
## SwasthyaSetu AI

---

## 1. Architectural Philosophy

Three doctrines drive every design decision, drawn directly from the research findings on why prior rural health-tech products failed:

1. **Logic-first, platform-second** — Triage rules, routing logic, and cost calculation live in a portable service layer, independent of whether the "front door" is a browser (Stage 1) or an offline mobile app (Stage 2).
2. **Deterministic safety wraps probabilistic AI** — Any generative/LLM component is always sandwiched inside a rule-based clinical-safety layer that has final authority over urgency classification and emergency escalation.
3. **Offline-first is a Day-1 architectural constraint, not a later optimization** — even though Stage 1 is a website, the API and data contracts are designed as if the client could go offline, so Stage 2 doesn't require re-architecture.

---

## 2. High-Level System Diagram (Stage 1 — Website Prototype)

```
                     ┌─────────────────────────────┐
                     │         CLIENT (Web)        │
                     │  React / Next.js + Tailwind │
                     │  - Symptom Input (Text/Voice)│
                     │  - Routing Result View        │
                     │  - ASHA Form Capture UI       │
                     │  - Admin Dashboard             │
                     └──────────────┬────────────────┘
                                    │  HTTPS / REST (JSON)
                                    ▼
                     ┌─────────────────────────────┐
                     │        API GATEWAY LAYER     │
                     │           FastAPI              │
                     └──────────────┬────────────────┘
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
   ┌──────────────────┐  ┌────────────────────┐ ┌───────────────────────┐
   │ Symptom Triage     │  │ Cost-Aware Routing  │ │ ASHA Digitization      │
   │ Service            │  │ Engine              │ │ Service                │
   │ - calls Trained AI  │  │ - calls Trained AI   │ │ - Vision field detect  │
   │   Model Service      │  │   Model Service       │ │ - Voice-to-text (native│
   │   (Track A)           │  │   (Track B)            │ │   language)            │
   │ - Rule-based safety │  │ - OOPE Calculator     │ │                          │
   │   layer (final say) │  │   (deterministic code) │ │                          │
   └─────────┬──────────┘  └──────────┬──────────┘ └───────────┬────────────┘
             │                        │                        │
             ▼                        ▼                        │
   ┌─────────────────────────────────────────────┐             │
   │        Trained AI Model Service                │             │
   │        (owned by AI/ML teammate)                │             │
   │  POST /predict/triage        (Track A)          │             │
   │  POST /predict/scheme-match  (Track B)           │             │
   │  — see AI Training System doc §5 for contract    │             │
   └─────────────────────────────────────────────┘             │
             │                        │                        │
             └────────────┬───────────┴────────────┬───────────┘
                           ▼                        ▼
                 ┌────────────────────┐   ┌───────────────────────┐
                 │   PostgreSQL DB     │   │  External Reference    │
                 │  - Facility data    │   │  Datasets (real sources,│
                 │  - Scheme/pricing   │   │  see AI Training System │
                 │  - ASHA records     │   │  doc §6.8):              │
                 │  - Anonymized       │   │  - PM-JAY HBPs (pricing) │
                 │    triage logs      │   │  - SECC 2011 (eligibility)│
                 │                     │   │  - PMBJP product/price list│
                 │                     │   │  - NLEM 2022 (price caps)│
                 │                     │   │  - NHA HEM/HFR (facilities)│
                 └────────────────────┘   └───────────────────────┘
```

**Note on module boundary:** The Trained AI Model Service is intentionally a separate, independently deployable component (its own FastAPI microservice) rather than code embedded inside the Triage/Routing services. This lets the AI/ML teammate iterate on models and retrain independently of the platform team's release cycle — the only shared surface is the API contract in §4.1a below.

---

## 3. High-Level System Diagram (Stage 2 — Mobile + Edge AI, Future)

```
┌───────────────────────────────────────────────────────────┐
│                     MOBILE DEVICE (2GB RAM)                 │
│  React Native App                                            │
│  ┌─────────────────────┐   ┌────────────────────────────┐ │
│  │ On-Device AI Engine   │   │  Local Persistence Layer     │ │
│  │ (compact multimodal   │   │  SQLite / Room                │ │
│  │  model — vision+voice)│   │  - Cached facility/scheme data│ │
│  │ - Symptom triage       │◄─►│  - Patient/ASHA records       │ │
│  │ - Form field detection │   │  - AES-256 encrypted at rest  │ │
│  │ - Native-language ASR  │   └───────────┬────────────────┘ │
│  └─────────────────────┘                 │                   │
│                                            ▼                   │
│                                ┌────────────────────────┐    │
│                                │ WorkManager Sync Agent   │    │
│                                │ (fires only when online) │    │
│                                └───────────┬──────────────┘    │
└────────────────────────────────────────────┼───────────────────┘
                                              │ Encrypted sync (opportunistic)
                                              ▼
                            ┌─────────────────────────────┐
                            │   Central FastAPI Backend    │
                            │   (shared with Stage 1)       │
                            │   - Aggregation                │
                            │   - Epidemiological surveillance│
                            │   - Admin dashboard data source │
                            └─────────────────────────────┘
```

---

## 4. Core Modules

### 4.1 Symptom Triage Service
- **Input:** free-text or transcribed voice symptom description, in a supported language.
- **Processing:**
  1. Calls the **Trained AI Model Service** (`POST /predict/triage`, Track A model) to extract structured symptom entities and a *suggested* urgency signal + confidence score.
  2. **Rule-based clinical-safety layer** checks extracted entities against a red-flag symptom list (e.g., chest pain, severe bleeding, breathlessness, high fever in infants). This layer has **override authority** — it can never be downgraded by the trained model's output, and it is the layer that actually finalizes a non-emergency classification (the model never clears a case as safe on its own — see AI Training System doc §2.3).
  3. If the model service is unreachable or confidence is below threshold, the service falls back to `CONSULT_SOON` by default — never a silent failure.
  4. Output: a final urgency tier — `EMERGENCY`, `CONSULT_SOON`, `SELF_CARE_ADVISORY`.
- **Output:** urgency tier + structured symptom summary passed to the Routing Engine.

### 4.1a Trained AI Model Service (New Module)
- **Ownership:** AI/ML teammate; independently deployable FastAPI microservice.
- **Exposes:** `POST /predict/triage` (Track A — symptom category + suggested urgency) and `POST /predict/scheme-match` (Track B — scheme/policy matching for a user's situation).
- **Contract:** every response includes a `confidence` score and a `model_version`; the service never returns a final diagnosis, medicine name/dosage, or a final cost number — only categorical signals for the deterministic layers above and below it to act on.
- **Stage 1:** called over the internal network (REST) from the Triage Service and Routing Engine.
- **Stage 2:** the same logical calls are served by an on-device inference module (quantized/exported model bundled with or fetched by the app) instead of a network call — see §8 (Pluggable AI-Engine Design) and the AI Training System doc §5.3.
- Full dataset, training methodology, and evaluation requirements: see the dedicated **AI Training System** document.

### 4.2 Cost-Aware Routing Engine
- **Input:** urgency tier, symptom category, user's approximate location, (optionally) free-text description of the user's situation or insurance details.
- **Processing:**
  - Calls the **Trained AI Model Service** (`POST /predict/scheme-match`, Track B model) to retrieve the most likely matching government scheme(s)/insurance clauses for the user's situation, with a confidence score per match.
  - Matches urgency + symptom category to the appropriate facility tier (Sub-Centre → PHC → CHC → PM-JAY empaneled hospital).
  - Applies the OOPE formula **as deterministic code, never as model-generated text**:
    `Estimated OOPE = Total Treatment Cost − (Insurance Coverage + Government Scheme Benefits)`
  - If a medicine-only need is detected, routes to nearest PMBJP/AMRIT outlet instead of/alongside a facility.
  - If Track B confidence is low or the model service is unavailable, falls back to showing all rule-matched schemes for the symptom category (never fabricates a match — see AI Ethics & Guardrails §2.4).
- **Output:** ranked list of recommended facilities/pharmacies with an estimated cost and scheme eligibility note.

### 4.3 ASHA Digitization Service
- **Stage 1 (web) simulation:** user uploads a photo of a paper form → server-side vision processing (OpenCV/Pillow + OCR) detects fields → UI prompts voice/text fill per field → structured JSON record generated.
- **Stage 2 (on-device) target:** identical flow performed entirely on-device (per the ASHA-G / Gemma 3n reference pattern), so no image or audio ever leaves the phone unencrypted.

### 4.4 Admin/Analytics Dashboard
- Reads only **anonymized, aggregated** data (counts, urgency-tier distributions, routing outcomes by region) — never individual patient records — enforcing the privacy-by-design principle at the architecture level, not just policy level.

---

## 5. Data Flow Summary

1. User → Symptom input (text/voice) → Triage Service
2. Triage Service → Urgency tier → Routing Engine
3. Routing Engine → Facility/pharmacy + cost estimate → back to User
4. (Parallel) ASHA form capture → structured record → PostgreSQL
5. (Stage 2 only) Local record → encrypted → WorkManager → central backend when online
6. Aggregated, anonymized data → Admin Dashboard

---

## 6. Security Architecture

| Layer | Control |
|---|---|
| Transport | TLS 1.2+ for all client-server communication |
| At Rest (Stage 2 mobile) | AES-256 encryption of local SQLite store |
| At Rest (Stage 1 server) | Standard managed-Postgres encryption at rest |
| Authentication | OAuth 2.0 / JWT for any authenticated (ASHA/admin) sessions |
| Data Minimization | Only anonymized/aggregated data reaches analytics; raw symptom text is not retained longer than needed for the session unless the user is an authenticated ASHA worker creating a record |
| Consent | Explicit consent capture before any data leaves the device/session for syncing or analytics inclusion |

---

## 7. Database Schema Overview (Illustrative)

**facilities**: id, name, type (SC/PHC/CHC/hospital), pm_jay_empaneled (bool), lat, lng, district, state

**schemes**: id, name (PM-JAY/PMBJP/AMRIT/state scheme), coverage_rules, eligibility_notes

**pricing**: id, facility_id / scheme_id, procedure_category, base_cost, subsidized_cost

**triage_sessions** (anonymized): id, urgency_tier, symptom_category, region, timestamp *(no PII)*

**asha_records**: id, worker_id (hashed), record_type (immunization/pregnancy/birth/death), structured_fields (JSON), created_at, synced_at

---

## 8. Scalability & Extensibility Notes

- The Routing Engine's facility/scheme data model is designed to be state/district-extensible — adding a new state's PM-JAY/PMBJP dataset should not require schema changes.
- The Triage Service's rule-based safety layer is stored as configurable clinical checklists (not hardcoded), so new red-flag protocols can be added without redeploying the model layer.
- Stage 2's local AI engine is designed as a **pluggable module** behind the same Triage Service interface used in Stage 1, so swapping cloud LLM → on-device model is an implementation change, not an architecture change.
- Because the Trained AI Model Service (§4.1a) is already isolated behind a stable API contract (`/predict/triage`, `/predict/scheme-match`) in Stage 1, the AI/ML teammate's Stage 2 deliverable is simply a re-exported, on-device-ready version of the *same* models — the calling services (Triage Service, Routing Engine) require no code changes, only a routing change from "network call" to "on-device call."

---

*This document should be read alongside the Tech Stack, Roadmap, and AI Training System documents. The AI Training System document is the authoritative spec for everything inside the Trained AI Model Service module (§4.1a).*
