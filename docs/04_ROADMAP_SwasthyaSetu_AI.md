# Roadmap & Step-by-Step Execution Plan
## SwasthyaSetu AI

---

## 1. Roadmap Philosophy

Build order follows the team's explicit direction: **prove the entire product logic on the website first**, then port the validated logic into the mobile app with the on-device edge AI engine as the final, most complex layer. This de-risks the project — the hardest technical component (on-device multimodal AI) is tackled *after* the product's core value proposition (cost-aware routing) is already validated and demo-able.

---

## 2. Phase 0 — Research & Definition *(Complete)*
- ✅ Deep research on Indian rural healthcare system flaws
- ✅ Competitive landscape analysis (Practo, Tata 1mg, eSanjeevani, Pristyn Care, Medicare Systems)
- ✅ Core differentiator identified: affordability + routing, not just symptom discovery
- ✅ PRD, Tech Stack, Architecture, AI Principles, AI Ethics, and Design documentation (this document set)

---

## 2a. Parallel Workstream — AI Training Track (Owned by AI/ML Teammate)

Model training runs **in parallel** with Phase 1, not before it — the platform team builds the Triage Service and Routing Engine against a stable API contract (`/predict/triage`, `/predict/scheme-match`) from Day 1, while the AI/ML teammate independently builds toward that same contract. Neither side blocks the other. Full detail in the dedicated **AI Training System** document.

| Step | Deliverable | Maps to Main Roadmap |
|---|---|---|
| T1 | Curate Track A (symptom) and Track B (scheme/pricing) datasets | Parallel to Step 1.2 (Seed Data Layer) |
| T2 | Train/fine-tune Track A triage model; build Track B retrieval pipeline | Parallel to Step 1.3–1.4 |
| T3 | Evaluate against safety bar (emergency recall priority) and per-language accuracy | Parallel to Step 1.8 (Internal Testing) |
| T4 | Ship Track A/B models behind `/predict/triage` and `/predict/scheme-match` as a FastAPI microservice | Consumed by Phase 1 Triage Service & Routing Engine |
| T5 | Re-export both models to an on-device/quantized format; benchmark against 2GB RAM / <100MB targets | Feeds directly into Phase 4 (On-Device Edge AI Engine) |
| T6 | Retraining pass using anonymized flagged/low-confidence session logs | Ongoing, cadence detailed in AI Training System doc §6 |

---

## 3. Phase 1 — Website Prototype (MVP) — *Primary Immediate Focus*

**Goal:** A fully functional web app demonstrating the entire user journey end-to-end, usable for SIH evaluation and pilot feedback.

### Step 1.1 — Foundation Setup
- Initialize repo (frontend: React/Next.js + Tailwind; backend: FastAPI)
- Set up PostgreSQL schema (facilities, schemes, pricing, triage_sessions, asha_records)
- Set up CI-friendly deployment (Vercel for frontend, Render/Railway for backend)

### Step 1.2 — Seed Data Layer
- Curate a starter dataset for **one pilot state/district**: PHC/CHC/hospital locations, PM-JAY empanelment status, PMBJP/AMRIT outlet locations, base + subsidized procedure costs
- Pull this from the real official sources (not invented figures): PM-JAY Health Benefit Packages, SECC 2011 eligibility data, PMBJP product/price list, NLEM 2022, and the NHA Hospital Empanelment Module/Health Facility Registry — exact links and download steps are in the AI Training System document, Section 6.8
- This dataset is the single most important early deliverable — the routing engine is only as good as this data

### Step 1.3 — Symptom Triage Service (Web)
- Build text input + browser voice input (Web Speech API)
- Implement rule-based red-flag/emergency checklist (deterministic, safety-critical)
- Integrate the **Trained AI Model Service's** `/predict/triage` endpoint (Track A, from the parallel AI Training Track) for symptom-entity extraction and suggested urgency, wrapped by the rule-based layer which has final authority
- Output urgency tiers: EMERGENCY / CONSULT_SOON / SELF_CARE_ADVISORY

### Step 1.4 — Cost-Aware Routing Engine
- Implement facility matcher (urgency + symptom category + location → ranked facility list)
- Integrate the **Trained AI Model Service's** `/predict/scheme-match` endpoint (Track B) for matching user situations to schemes/insurance clauses
- Implement OOPE calculator (deterministic code, not model-generated) using the formula:
  `Estimated OOPE = Total Treatment Cost − (Insurance Coverage + Government Scheme Benefits)`
- Implement medicine-only routing to nearest PMBJP/AMRIT outlet

### Step 1.5 — ASHA Digitization Prototype
- Build photo-upload UI for paper forms
- Server-side field detection (OCR/vision) prototype
- Voice-fill confirmation flow per detected field, in native language
- Generate structured JSON record → store in `asha_records`

### Step 1.6 — Admin/Analytics Dashboard
- Aggregate, anonymized view: triage volume, urgency-tier distribution, routing outcomes by region
- Built with Recharts on the existing React frontend

### Step 1.7 — Multilingual Layer
- Integrate i18next; ship UI in minimum 2 regional languages + Hinglish/Banglish
- Validate voice input accuracy for at least one regional language end-to-end

### Step 1.8 — Internal Testing & SIH Demo Prep
- End-to-end run-throughs of all 3 personas (patient, ASHA worker, admin)
- Stress-test the safety layer with emergency-symptom test cases
- Prepare the pitch narrative connecting each screen back to a specific research-backed statistic (OOPE 39.4%, 42.9% pharmacy spend, etc.)

**Phase 1 Exit Criteria:** A judge or pilot user can, unaided, complete a symptom-to-routing flow and an ASHA form-digitization flow on the live website.

---

## 4. Phase 2 — Feedback & Refinement
- Gather feedback from SIH judges, mentors, and (if feasible) real ASHA workers/health center staff
- Refine triage red-flag checklist based on clinical mentor review (if a medical advisor is available to the team)
- Expand seed dataset to a second district/state if time allows
- Harden emergency escalation copy/UX (this is the highest-liability surface)

---

## 5. Phase 3 — Mobile App Build (React Native)
**Goal:** Port the validated Stage 1 logic into a cross-platform mobile app.

### Step 3.1 — App Shell & Navigation
- Set up React Native project; reuse component/UX patterns from the web app
- Implement icon-driven navigation for low-literacy users

### Step 3.2 — Local Persistence Layer
- Implement SQLite/Room local database mirroring the Postgres schema
- Implement AES-256 encryption for local storage

### Step 3.3 — Offline Triage & Routing (Cloud-Backed First)
- Initially, port the Stage 1 triage/routing logic to run against a cached local copy of the facility/scheme dataset (no on-device AI yet — still uses cloud LLM API when online, cached rule-based logic when offline)
- This delivers offline *routing* value even before the full on-device AI engine is built

### Step 3.4 — Background Sync
- Implement WorkManager-based opportunistic sync of ASHA records and anonymized triage logs

### Step 3.5 — ASHA Kiosk Mode
- Build the simplified, high-contrast, minimal-navigation kiosk interface for frontline workers
- Target: 2-hour onboarding time

---

## 6. Phase 4 — On-Device Edge AI Engine *(Explicitly Deferred, Final Major Milestone)*
**Goal:** Replace the cloud-LLM-dependent triage/vision pipeline with a fully on-device, offline-capable multimodal engine.

### Step 4.1 — Model Selection & Benchmarking
- Evaluate compact multimodal models (e.g., 4B-parameter class such as Gemma 3n) for on-device inference feasibility on 2GB RAM target devices
- Benchmark app size against the <100MB target
- Take the AI/ML teammate's re-exported, on-device-ready Track A/B models (Step T5 in §2a) as the starting artifact — this step is re-benchmarking and integration, not training from scratch

### Step 4.2 — On-Device Vision Pipeline
- Implement photographed-form → field-detection entirely on-device (no server round-trip)

### Step 4.3 — On-Device Voice Pipeline
- Implement native-language voice-to-structured-text transcription on-device (e.g., spoken Hindi → Devanagari text)

### Step 4.4 — Integration & Fallback Logic
- Wire the on-device engine behind the same Triage Service interface used in Stage 1/3 (architecture already supports this — see System Architecture doc §8)
- Implement graceful fallback to cloud LLM when online and on-device confidence is low, if such a hybrid mode is desired

### Step 4.5 — Field Validation
- Test with real ASHA workers on actual low-end devices in field-like (low/no connectivity) conditions

---

## 7. Phase 5 — Adherence & Financial-Literacy Layer (Stretch Goals)
- SMS/WhatsApp medication adherence reminders for chronic disease (hypertension, diabetes) patients
- USSD or WhatsApp-chatbot financial literacy tool: PM-JAY wallet balance check, hospital empanelment verification, overcharging report mechanism

---

## 8. Phase 6 — Scale & Government/NGO Integration (Post-Hackathon Vision)
- Formal data-sharing partnership discussions with state health departments for epidemiological surveillance use
- Expansion of the seed dataset to national coverage
- Potential integration pathways with existing government platforms (e.g., data interoperability with ABDM — Ayushman Bharat Digital Mission — as a future exploration, not a current dependency)

---

## 9. Roadmap Summary Table

| Phase | Deliverable | AI Complexity | Status |
|---|---|---|---|
| 0 | Research & Docs | — | ✅ Complete |
| 2a | AI Training Track (parallel, owned by AI/ML teammate) | Medium–High | 🔵 Runs alongside Phase 1 |
| 1 | Website Prototype (full logic, trained AI via API) | Medium | 🔵 Immediate focus |
| 2 | Feedback & Refinement | — | ⬜ Next |
| 3 | Mobile App Shell + Offline Routing (trained AI via API when online) | Medium | ⬜ Planned |
| 4 | On-Device Edge AI Engine (re-export of Phase 2a models) | High | ⬜ Deferred (final major build) |
| 5 | Adherence & Financial Literacy Tools | Low | ⬜ Stretch |
| 6 | Scale & Government Integration | — | ⬜ Post-hackathon vision |

---

*This document should be read alongside the PRD (for requirements), System Architecture (for how the pluggable AI-engine design enables Phase 4 without a rebuild), and the AI Training System document (the authoritative spec for the parallel workstream in §2a).*
