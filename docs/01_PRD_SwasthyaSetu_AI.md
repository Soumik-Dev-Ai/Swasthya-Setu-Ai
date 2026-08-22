# Product Requirements Document (PRD)
## SwasthyaSetu AI — Offline-First Healthcare Navigation & Affordability Platform
**Version 1.0 | Smart India Hackathon 2026**

---

## 1. Executive Summary

SwasthyaSetu AI ("Bridge to Health") is a lightweight, offline-first digital health platform designed to close the accessibility, data, and affordability gaps in India's rural healthcare system. Unlike existing platforms (Practo, Tata 1mg, eSanjeevani) which are urban-first, connectivity-dependent, and disease-discovery focused, SwasthyaSetu AI repositions itself as an **Integrated Healthcare Affordability and Navigation System** — one that tells a patient not just *what might be wrong*, but *where to go and what it will actually cost them*.

The product will be built in two stages:
- **Stage 1 (Prototype/MVP):** A web application that proves out the core logic — AI-assisted symptom triage, cost-aware routing, and ASHA-worker digitization workflows — without hardware constraints.
- **Stage 2 (Production):** A React Native mobile app with an on-device, offline-capable local AI engine, targeting 2GB RAM smartphones common in rural India.

This document defines the problem, users, scope, and requirements for both stages, with Stage 1 (website) as the immediate build target.

---

## 2. Problem Statement

India's healthcare system suffers from a structural paradox: world-class tertiary care coexists with a rural primary-care vacuum.

| Problem Area | Evidence |
|---|---|
| **Workforce shortage** | 18.8% PHC doctor vacancy; 51.6% specialist vacancy in CHCs |
| **Informal care dependency** | 70%+ of rural primary care delivered by unregulated informal providers (NDAPs) |
| **Analog data friction** | ASHA workers rely on paper registers, causing errors, data loss, and reporting latency |
| **Financial toxicity** | Out-of-pocket expenditure (OOPE) is 39.4% of total health spending; 42.9% of OOPE goes to retail pharmacy purchases alone |
| **Urban-biased market** | Practo and eSanjeevani assume smartphones, digital literacy, and stable broadband — all scarce in rural India |
| **No affordability layer** | Existing symptom checkers tell users *what* disease they may have, never *how to afford* treatment or which subsidized scheme/pharmacy to use |
| **Bypassed public infrastructure** | Commercial apps route users to private doctors, ignoring PM-JAY, AMRIT, and PMBJP subsidized networks |

**Core insight driving the product:** The biggest unsolved problem is not diagnosis — it is navigation and affordability. A rural user does not need another symptom checker; they need a system that connects symptoms → correct point of care → cheapest legitimate payment/subsidy path.

---

## 3. Goals and Success Metrics

### 3.1 Product Goals
1. Provide reliable, low-literacy-friendly symptom triage in regional languages (voice-first).
2. Route patients to the *correct* and *cheapest* legitimate care option (PHC/CHC, PM-JAY empaneled hospital, AMRIT/PMBJP pharmacy) instead of defaulting to private care.
3. Digitize ASHA worker data capture without adding administrative burden.
4. Operate reliably in low/no-connectivity environments (offline-first, sync-when-available).
5. Improve medication adherence for chronic disease patients via low-bandwidth nudges (SMS/WhatsApp).

### 3.2 Success Metrics (MVP/Web Prototype)
| Metric | Target |
|---|---|
| Symptom-to-routing completion rate | >80% of sessions reach a routing recommendation |
| Cost-estimate accuracy vs. actual scheme benefit | Within stated logic (rule-based, verifiable) |
| ASHA form digitization time | <3 minutes per form (vs. paper baseline) |
| Language coverage at MVP | Minimum 2 regional languages + Hinglish/Banglish text input |
| Judge/user comprehension in SIH demo | Non-technical evaluator can complete a full flow unaided |

### 3.3 Long-Term (Post-Hackathon) Metrics
- Reduction in average OOPE per triaged user (via routing to subsidized nodes)
- % of ASHA workers retained using the tool after 2-hour onboarding
- Offline session success rate on 2GB RAM devices
- Medication adherence uplift (target: directionally consistent with published SMS-nudge research, ~15–20% absolute improvement)

---

## 4. Target Users & Personas

### Persona 1: Rural Patient (Primary End User)
- Low-to-medium literacy, basic Android smartphone or feature phone access via a family member
- Speaks a regional language/dialect; not comfortable typing in English
- Cannot afford unnecessary private consultation or medicine markup
- **Need:** "Am I okay, where do I go, and what will it cost me?"

### Persona 2: ASHA Worker (Frontline Health Worker)
- Government or personal low-RAM Android device
- Overloaded with paper registers (pregnancy, immunization, birth/death records)
- Needs speed, not more training — low digital literacy tolerance
- **Need:** Convert a photographed paper form into structured digital data via voice, with zero typing.

### Persona 3: Informal/Rural Medical Practitioner (NDAP)
- No formal degree but is the de facto first point of contact for 70%+ of rural patients
- Would benefit from decision-support checklists to reduce misdiagnosis/over-prescription
- **Need:** A lightweight clinical checklist and referral tool that upskills without requiring certification.

### Persona 4: Program Administrator / Health Authority (Secondary User)
- District/state health officials or NGO partners
- **Need:** Aggregated, anonymized epidemiological visibility from informal and ASHA-sourced data.

---

## 5. Scope

### 5.1 In Scope — Stage 1 (Website Prototype)
- Web-based symptom triage flow (text + voice input where feasible in-browser)
- Rule-based / AI-assisted urgency classification (green/yellow/red triage levels)
- Cost-aware routing engine (maps symptom + location → PHC/CHC/PM-JAY hospital/AMRIT/PMBJP pharmacy, with an estimated OOPE calculation)
- ASHA digitization prototype: form upload/photo → structured field extraction → voice-filled confirmation (browser-based simulation of the on-device pipeline)
- Admin/analytics dashboard: anonymized aggregate view of triage volumes and routing outcomes
- Multilingual UI (minimum viable: 2 Indian languages + Hinglish)
- Responsive design usable on low-end mobile browsers

### 5.2 In Scope — Stage 2 (Mobile App, later phase)
- React Native offline-first app
- On-device local AI engine (multimodal vision + voice, edge-computing model such as a compact Gemma-class model) — **explicitly deferred**, but architected for from Day 1
- ASHA Kiosk Mode
- SQLite/Room local persistence with WorkManager-based background sync
- AES-256 local encryption, OAuth 2.0 authentication
- SMS/IVR/WhatsApp adherence reminder integration

### 5.3 Out of Scope (All Stages)
- Direct clinical diagnosis or prescription issuance (product is decision-support, not a diagnostic authority)
- Replacing ASHA workers, informal providers, or doctors
- Processing/storing biometric health records beyond anonymized/aggregated epidemiological data without explicit consent
- Payment processing/insurance claims settlement (routing and estimation only, not a financial transaction system)

---

## 6. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | User can describe symptoms via text or voice in a supported regional language | Must |
| FR-2 | System classifies urgency (routine / needs consultation / emergency) using a rule-based clinical protocol layer, optionally augmented by an LLM for language understanding | Must |
| FR-3 | System recommends nearest appropriate facility type (Sub-Centre/PHC/CHC/PM-JAY hospital) based on urgency and user location | Must |
| FR-4 | System calculates an estimated Out-of-Pocket Expense using: `Estimated OOPE = Total Treatment Cost − (Insurance Coverage + Government Scheme Benefits)` | Must |
| FR-5 | System routes medicine-related queries to the nearest PMBJP/AMRIT outlet | Must |
| FR-6 | ASHA workflow: upload/photograph a paper form → auto-detect fields → voice-fill in native language → generate structured record | Must |
| FR-7 | Emergency/red-flag symptoms trigger an immediate escalation message (e.g., "seek emergency care now / call [emergency number]") bypassing routine routing logic | Must |
| FR-8 | Admin dashboard shows anonymized, aggregated triage and routing statistics | Should |
| FR-9 | Session/data works offline (mobile phase) and syncs opportunistically when connectivity resumes | Should (Stage 2) |
| FR-10 | Adherence reminder module sends scheduled SMS/WhatsApp nudges for chronic disease patients | Could (Stage 2) |

---

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Web prototype must load and respond on 3G-equivalent bandwidth simulation; app target: functional on 2GB RAM devices, <100MB install size |
| **Availability** | Mobile app: 100% core-triage uptime offline; web: standard hosting SLA for demo/pilot |
| **Accessibility** | Voice-first interaction; icon-driven UI; support for non-literate users |
| **Security** | AES-256 for locally stored data (Stage 2); TLS in transit; OAuth 2.0 authentication for any account-based features |
| **Privacy** | Privacy-by-design — no raw personal health data leaves the device without explicit sync consent; anonymization before any epidemiological aggregation |
| **Localization** | Minimum 2 regional languages + Hinglish/Banglish transliteration support at MVP, extensible architecture for more |
| **Maintainability** | Modular architecture separating triage logic, routing logic, and UI so the local AI engine can be swapped in during Stage 2 without redesigning the product |

---

## 8. Assumptions

- Government scheme data (PM-JAY empanelment lists, PMBJP/AMRIT outlet locations, package costs) is available via public datasets/APIs or will be manually curated for the prototype.
- The web prototype is a functional proof-of-concept for judges/pilot users, not the final distribution channel — final reach is via the mobile app.
- Voice-native, on-device multimodal AI (as used by initiatives like ASHA-G) is feasible for Stage 2 but is **not required** for the Stage 1 website, which may use cloud-based APIs to simulate the same UX.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Public scheme data is fragmented/outdated | Build a curated, editable local dataset layer; treat live government APIs as a future integration, not a Day-1 dependency |
| AI misclassifies urgency (false negative on emergency) | Conservative rule-based safety layer always overrides AI judgment for red-flag keywords/symptoms (see AI Ethics & Guardrails doc) |
| Low trust from ASHA workers/informal providers | Kiosk mode, 2-hour onboarding target, and minimal-typing voice UX to reduce adoption friction |
| Regulatory/liability exposure from health suggestions | Explicit "decision-support, not diagnosis" framing throughout UI and legal disclaimers; no prescription generation |

---

## 10. Dependencies

- Public health scheme datasets — specifically: PM-JAY Health Benefit Packages (pmjay.gov.in), SECC 2011 eligibility data, PMBJP Jan Aushadhi product/price list (pmbi.co.in), National List of Essential Medicines 2022 (nppa.gov.in), and the NHA Hospital Empanelment Module / Health Facility Registry — full download instructions for each are in the AI Training System document, Section 6.8
- Regional language NLP/ASR resources
- Hosting infrastructure for the web prototype
- (Stage 2) Access to a compact, on-device-capable multimodal model
- **Trained AI models (symptom detection and scheme/insurance cost-matching)** — owned as a separate parallel workstream by the AI/ML teammate; the platform team consumes these models only via the stable API contract (`/predict/triage`, `/predict/scheme-match`) defined in the AI Training System document, so Phase 1 build is not blocked on training completion

---

## 11. Open Questions for Team Alignment

1. Which two languages will be prioritized for the MVP (likely Hindi + Bengali given SIH team context, given the name "SwasthyaSetu" and "Banglish" reference in the PPT)?
2. Will the web prototype use a live LLM API for triage NLU, or a rule-based/keyword classifier for the hackathon demo, with LLM as an enhancement layer?
3. What is the minimum viable geographic dataset (which district/state) for the routing demo?

---

*This PRD should be read alongside: System Architecture, Tech Stack, Roadmap, AI Principles, AI Ethics & Guardrails, and AI Training System documents.*
