# Document 1 — Product Requirements Document (PRD)
**Project:** SwasthyaSetu AI · **PS:** SIH26133 · **Status key:** 🟢 EXISTING · 🟡 EXTEND · 🔴 NEW

---

## 1. Problem Statement Restatement

SIH26133 asks for a system that improves **access, continuity, quality, and accountability** of public healthcare in rural and underserved India — *without bypassing the public system*, the way commercial apps do. In our own words, grounded in the research report:

> Rural India's public healthcare hierarchy (Sub-Centre → PHC → CHC → District/Referral Hospital) is starved of staff — 18.8% PHC doctor vacancy, 51.6% CHC specialist vacancy — which pushes 70–77% of rural primary care onto informal, non-degree providers (NDAPs). The ~1 million ASHA workers who bridge this gap are trapped in paper-based workflows that introduce transcription error and reporting latency. When patients do reach a facility, they carry no continuous record between tiers, have no visibility into which facility can actually treat them, and face Out-of-Pocket Expenditure that — even after falling from 62.6% (2014-15) to 39.4% (2021-22) of total health spending — remains catastrophic for the bottom 40% of the population that PM-JAY exists to protect. A solution must strengthen this existing public hierarchy, not route around it into a private-pay marketplace.

## 2. Vision Statement

SwasthyaSetu AI is the offline-first navigation layer that sits on top of India's public healthcare hierarchy: it tells a rural patient or ASHA worker, in their own language, on a ₹5,000 Android phone, with no internet connection, three things — *am I in danger, where should I go, and what will it actually cost me* — and then keeps a continuous, referral-tracked record of that patient as they move from Sub-Centre to District Hospital, so that no one falls through the cracks between tiers of a system that is trying, and under-resourced, to help them.

## 3. Target Users & Personas

| Persona | Age/Role | Tech literacy | Language | Device | Pain point | Core need |
|---|---|---|---|---|---|---|
| **Meena** — Rural Patient | 34, farm laborer, Bihar | Low; can operate WhatsApp voice notes, can't type well | Bhojpuri/Hindi, low English | Shared 2GB RAM Android, patchy 2G/3G | Doesn't know if her fever needs a doctor or will resolve; doesn't know which facility is free vs. paid | "Am I okay, where do I go, what will it cost me?" |
| **Radha** — ASHA Worker | 29, government-accredited health worker | Medium; comfortable with basic apps, not comfortable typing forms | Hindi, native script only | Government-issued or personal low-RAM Android | Fills 6+ paper registers daily; duplicate data entry; records lost in transit | Fast, voice/photo-driven digitization that doesn't require a data connection |
| **Ramesh** — Informal Provider (NDAP) | 45, no formal MBBS, de facto first point of contact in his village | Low-medium | Regional dialect | Personal Android, intermittent connectivity | No clinical decision support; over-prescribes because consultation + dispensing is his revenue model | A checklist that tells him when a case is beyond what he should handle |
| **Dr. Verma** — PHC Medical Officer | 41, staffs an understaffed PHC covering 3 Sub-Centres | High | Hindi/English | Desktop + Android | No visibility into which patients ASHAs referred, or whether they reached the CHC | A referral-tracking view of patients moving up the tier |
| **Ms. Iyer** — District Health Administrator | 38, NHM State PMU / District Health Officer | High | English/regional | Desktop | No real-time aggregate view of facility load, referral completion rate, or high-risk-patient follow-up gaps across her district | A facility/district dashboard, not another paper report |

## 4. Functional Requirements

Legend: **P0** = required for SIH demo · **P1** = should-have if time allows · **P2** = nice-to-have / post-hackathon

| ID | Priority | Status | Requirement |
|---|---|---|---|
| **FR-1** | P0 | 🟢 | **Text/voice symptom triage.** User enters symptoms via text or voice (regional language). System runs the deterministic rule engine + LLM cascade and returns urgency tier (L1–L4). *Data flow:* client → `POST /v2/triage` → deterministic keyword scan (always runs first) → LLM cascade (if no red flag) → response. *Acceptance:* every one of the 41 red-flag keywords, in all 3 supported languages, returns L4 in under 200ms with zero network calls. |
| **FR-2** | P0 | 🟢 | **Image-based triage (rash/wound/lab report).** User uploads a photo. System routes it through the 3-stage vision cascade (Gemini → Groq → NVIDIA NIM). *Acceptance:* if all 3 providers fail/timeout, system returns `confidence: 0, status: "uncertain"` and never crashes or blocks the text-based safety gate. |
| **FR-3** | P0 | 🟢 | **Deterministic safety override.** Any red-flag keyword match forces L4 Emergency regardless of AI output; AI cannot downgrade a text-triggered flag (`vision_downgrade_blocked: true` set and surfaced to UI when this fires). *Acceptance:* automated test suite of 100+ adversarial phrasings (see `09_QA_TEST_PLAN.md`) achieves 0% false-negative rate on true emergencies. |
| **FR-4** | P0 | 🟢 | **OOPE / Cost Analyzer.** User selects disease + hospital type + funding route (PM-JAY / private insurance / uninsured). System returns an itemized cost estimate against the curated 10-disease benchmark DB (95% confidence) or, if scraping is enabled, a web-sourced estimate flagged `community_estimate_unverified`. *Acceptance:* PM-JAY-eligible + empaneled-hospital path always returns ₹0 patient cost for in-database procedures. *Data freshness:* the underlying DB now refreshes quarterly via the mechanically-verified, government-only ETL pipeline in `16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md` — this is a data-sourcing change only, the query-time lookup mechanism is unchanged. |
| **FR-5** | P0 | 🟢 | **Scheme eligibility matching.** User inputs basic demographic/income data; system checks eligibility against the 8-scheme matcher (PM-JAY, CGHS, ESIC, JSY, PMNDP, HMDG, Chiranjeevi, WBHS). *Acceptance:* deterministic — no LLM in the eligibility decision path. *Data freshness:* scheme rule updates flow through the same doc 16 ETL pipeline as FR-4. |
| **FR-6** | P0 | 🟢 | **Tiered facility routing.** Given urgency + location + funding route, system recommends Sub-Centre / PHC / CHC / PM-JAY-empaneled hospital from the 16-facility dataset, shown on an offline-capable map (Pigeon Maps, OSM tiles). *Acceptance:* works with zero network connectivity using the client-side dataset fallback. |
| **FR-7** | P0 | 🟢 | **ASHA field data capture.** ASHA photographs a paper form; on-device vision extracts fields; ASHA confirms/edits by voice in native language; record queues locally (SQLite) and syncs via idempotent upsert (`worker_id` + `device_local_id` composite key) when connectivity returns. *Acceptance:* zero duplicate rows after 50 consecutive offline→online sync cycles in testing. |
| **FR-8** | P0 | 🟢 | **Auth & role separation.** JWT (HS256, 24h expiry) with ASHA / ADMIN roles; route guards enforce role on every protected endpoint. |
| **FR-9** | P0 | 🔴 | **Longitudinal patient record.** Every triage/referral/visit event for a given patient (matched by phone number + demographic hash, not Aadhaar) is appended to a persistent timeline, viewable by any authorized ASHA/PHC/CHC user in the referral chain. *Data flow:* new `patient_records` + `patient_events` tables (see `03_SYSTEM_ARCHITECTURE.md` §6); every existing triage/referral write also inserts a `patient_events` row. *Acceptance:* a patient referred Sub-Centre→PHC→CHC shows all three events, in order, to a CHC-level user. |
| **FR-10** | P0 | 🔴 | **Referral tracking.** When routing recommends escalation to a higher tier, system creates a `referral` record with status (`pending`/`in_transit`/`arrived`/`completed`/`lost`); the sending and receiving facility's dashboard both show it. *Acceptance:* referral completion rate is computable as a single aggregate query. |
| **FR-11** | P1 | 🔴 | **High-risk follow-up engine.** A scheduled job flags patients tagged maternal/child/chronic-disease whose expected follow-up window has lapsed with no new `patient_events` entry; surfaces as a worklist to the assigned ASHA. *Acceptance:* a seeded test patient with a 14-day-old, uncompleted follow-up appears in the worklist within one scheduler cycle. |
| **FR-12** | P1 | 🔴 | **Diagnostic / medicine availability visibility.** Facility records carry a `diagnostic_capacity` and `medicine_stock_snapshot` field, manually/periodically updated (not live) from the public NHA Health Facility Registry directory plus PMBJP generic-medicine listings; surfaced on the facility card as "last updated" data, explicitly labeled non-real-time. *Acceptance:* UI never implies this is a live feed — every instance carries a visible timestamp. |
| **FR-13** | P1 | 🔴 | **Facility / district dashboard.** ADMIN-role users see aggregate charts: triage volume by urgency tier, referral completion rate, follow-up backlog, facility load — computed from data the system already collects. *Acceptance:* dashboard loads from cached aggregates, not a live scan of raw tables, to stay responsive on Render's free tier. |
| **FR-14** | P2 | 🔴 | **FHIR-India-shaped export.** Patient/referral records can be exported in a FHIR India Core-compatible JSON shape, without registering for or calling any live ABDM/NHA production API. *Acceptance:* exported JSON validates against a public FHIR India Core schema definition (self-hosted validator, no external gated call). |
| **FR-15** | P1 | 🟢 | **9-language i18n.** All triage/UI copy available in 9 Indian languages with correct script rendering. |
| **FR-16** | P2 | 🔴 | **SMS/WhatsApp adherence nudge (stub).** Post-hackathon roadmap item; for demo, build only the trigger logic + message template, not a live gateway integration (avoids a paid API dependency). |

## 5. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Performance | Deterministic safety-gate response: **< 200ms**, zero network calls. LLM-cascade triage response: **< 3s p95** when online (15s hard timeout per cascade stage). |
| NFR-2 | Device constraint | Functional on **2GB RAM** Android devices; web bundle target **< 100MB**; app must not crash under low-memory conditions (test via Chrome DevTools device emulation + memory throttling). |
| NFR-3 | Network constraint | Full triage + routing + cost-estimate flow (excluding vision cascade) must work on **zero connectivity** using the client-side dataset fallback. |
| NFR-4 | Accessibility | **WCAG 2.1 AA**: minimum 4.5:1 text contrast, 44×44px touch targets, full keyboard navigation, screen-reader labels on all interactive elements. |
| NFR-5 | Security | Pydantic strict schema validation on every endpoint (reject malformed/oversized payloads with HTTP 422, never 500); SQL-injection-proof `SafeId` regex on all identifier inputs; rate limiting (200/min default, 10/min on search-heavy endpoints); AES-256 for any locally cached PII; JWT HS256 with 24h expiry. |
| NFR-6 | Privacy / DPDP Act 2023 | No PII transmitted or stored without explicit, revocable consent; patient matching uses phone number + demographic hash rather than Aadhaar/government ID; on-device processing preferred for any biometric-adjacent data (photos); data retention limited to active session unless the user (or their ASHA, with consent logged) opts into longitudinal record storage under FR-9. |
| NFR-7 | Availability | Deterministic safety layer must have **100% uptime characteristics** — it has no external dependency by design, so "uptime" here means it always executes even if every other subsystem fails. |

## 6. Out of Scope (explicitly, to prevent scope creep)

- Real-time video/audio teleconsultation (architectural choice: async, offline-first by design — see `03_SYSTEM_ARCHITECTURE.md` for the explicit rationale to state in your submission).
- Live ABDM/PM-JAY beneficiary production API integration or any government data-sharing MoU.
- Named medical diagnosis or medication/dosage prescription output (hard AI-ethics restriction, see `04_AI_SAFETY_ETHICS.md`).
- Live, continuously-updated hospital bed/medicine-stock feeds (no public API exists; FR-12 is explicitly a periodic-snapshot feature, not a live one).
- Payment processing of any kind.
- Native Android/iOS binaries for the hackathon demo (React Native mobile app is a post-hackathon Phase 3 item per `08_ROADMAP_EXECUTION_PLAN.md`).

## 7. Success Metrics

| Metric | Target | How measured |
|---|---|---|
| Emergency recall (true emergencies correctly flagged L4) | **≥ 0.95** | Adversarial test suite in `09_QA_TEST_PLAN.md` |
| Overall triage tier accuracy vs. WHO IMCI / clinical checklist ground truth | **≥ 0.75** | Held-out labeled symptom set |
| Deterministic safety-gate latency | **< 200ms**, offline | Automated timing test |
| Vision-cascade full-failure handling | **0 crashes** across 50 forced-failure runs | Chaos test: block all 3 provider endpoints |
| Offline-mode functional test | **100% pass** on FR-1, 4, 5, 6 with airplane mode enabled | Manual + Cypress offline-mode test |
| WCAG 2.1 AA audit | **0 critical violations** | axe-core automated scan + manual keyboard walkthrough |
| Referral completion visibility (FR-10) | Referral status computable for **100%** of routed L3/L4 cases | Integration test |
| Language coverage | All P0 flows functional in **9/9** languages | Manual QA pass per language |
