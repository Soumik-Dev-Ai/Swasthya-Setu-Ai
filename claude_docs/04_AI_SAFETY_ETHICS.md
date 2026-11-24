# Document 3 — AI Principles & Ethics Guardrails
**Status key:** 🟢 EXISTING · 🟡 EXTEND · 🔴 NEW

---

## 1. Core AI Principles (non-negotiable) 🟢

1. **Decision support, never diagnostic authority.** The system classifies urgency and recommends routing — it never names a disease as a diagnosis.
2. **Deterministic safety always overrides probabilistic AI.** The 41-keyword safety gate cannot be overruled by any LLM output, at any confidence level.
3. **Low-resource-first design.** Every feature is benchmarked against a 2GB RAM device and a <100MB footprint before it is considered "done."
4. **Linguistic & literacy equity.** Voice-first, native-script, usable by a non-literate user — text-only UX is treated as an accessibility failure, not a default.
5. **Privacy by design.** No unconsented PII transmission; on-device processing preferred wherever the hardware allows it.
6. **Affordability-aware.** Every clinical recommendation is paired with a cost/scheme pathway — a routing suggestion without a cost estimate is an incomplete response.
7. **Transparency & explainability.** Every AI-influenced output carries a plain-language reason and a confidence indicator the user can see.
8. **Human-in-the-loop.** ASHA workers and clinicians confirm any record before it's treated as final; the AI proposes, a human disposes.
9. **Continuous field-grounded validation.** Clinical logic is benchmarked against WHO IMCI and IPHS guidelines, not just raw model accuracy.
10. **Fail safe, not fail silent.** Ambiguous or low-confidence cases default to a conservative `CONSULT_SOON` tier — the system never guesses toward "you're probably fine."

## 2. Hard Restrictions — the AI must NEVER

| Restriction | Example of what this blocks |
|---|---|
| No named medical diagnoses | ❌ "You have dengue." → ✅ "Your symptoms match a pattern that needs same-day evaluation at a CHC." |
| No medication names, dosages, or prescriptions | ❌ "Take 500mg paracetamol every 6 hours." → ✅ "Discuss pain management with the provider at your recommended facility." |
| No downgrading or suppressing an emergency classification | The vision cascade returning `non_serious` can never overwrite a text-triggered L4 flag — enforced in code, not policy (`vision_downgrade_blocked: true`). |
| No hallucinating facility, pricing, or scheme details | If the curated DB has no entry and web-scraping is disabled, the system returns `no_estimate_available` — never a plausible-sounding invented number. |
| No data retention beyond active session without explicit consent | FR-9's longitudinal record is opt-in and logged as a consent event, not a default. |
| No output that implies certainty the system doesn't have | Every AI-sourced (non-deterministic) output carries a visible confidence tag. |

## 3. Safety Layer Specification 🟢

This is the single most load-bearing component in the system. It is **100% deterministic — no LLM, no ML model, no network call.**

**Keyword set:** 41 red-flag terms across English, Hindi, and Bengali — e.g. `"chest pain"`, `"difficulty breathing"`, `"unconscious"`, `"stroke"`, `"seizure"`, `"suicidal"`, `"severe bleeding"`, `"anaphylaxis"`, `"snake bite"`, `"heart attack"`, `"cardiac arrest"`, `"no pulse"`, `"blue lips"`, `"cyanosis"`, `"सीने में दर्द"`, `"বুকের ব্যথা"`, plus 25 more covering equivalent clinical red flags in all three languages.

**Escalation logic (exact ruleset):**
```
1. Scan input text against the full 41-keyword list (case/script-insensitive, all 3 languages).
2. If ANY keyword matches → tier = L4 (Emergency), source = "deterministic", regardless of
   what any downstream AI model would have said. This check runs BEFORE any AI call is made.
3. If the vision model independently returns "emergency" but text-based scan says
   "non_serious" → escalate to L4 anyway (fail toward caution — the more cautious of
   the two signals always wins).
4. If the vision model returns "non_serious" but the text scan already matched a red flag
   → the downgrade is BLOCKED. The AI's "non_serious" reading is discarded, the L4
   classification stands, and the response includes `vision_downgrade_blocked: true`
   so the frontend can show the user (and, in testing, the QA team) that an override
   attempt occurred and was rejected.
5. No confidence threshold, model version, or prompt change can alter steps 1-4 — the
   safety gate has zero code paths that accept an AI-supplied override value.
```

## 4. Bias & Fairness Considerations

| Axis | Risk | Mitigation |
|---|---|---|
| **Language** | Non-Hindi/English/Bengali speakers get degraded triage quality | 9-language i18n (FR-15); safety-gate keyword set must expand to any additional language before that language is marked "supported" — a language toggle without a matching keyword set is a safety bug, not a cosmetic gap |
| **Caste / social status** | NDAP and ASHA-mediated care can carry local social bias in who gets prioritized for referral | Referral urgency (FR-10) is computed purely from the deterministic triage tier, never from any field capturing caste, religion, or social category — those fields must not exist in the schema at all |
| **Gender** | Maternal-health follow-up logic (FR-11) must not be used as a proxy to restrict a woman's own access decisions | Follow-up worklist is a *prompt to the ASHA to reach out*, never a gate that blocks the patient from any other flow |
| **Geography** | Facility data is denser for well-documented urban-adjacent hospitals (16 seeded facilities) than for remote rural ones | Explicitly disclosed as a current dataset limitation in `07_DATA_CATALOG.md`; routing logic must never imply "no options" when the truth is "our dataset is incomplete" — degrade to Sub-Centre/PHC-tier defaults rather than showing an empty result |

## 5. Transparency Requirements

- Every screen showing a triage or cost result displays: **"Decision support, not a medical diagnosis"** disclaimer, always visible, never behind a tooltip.
- Every AI-sourced value (vision cascade result, web-scraped price) shows its **confidence tag** (`verified_official_data` / `community_estimate_unverified` / `uncertain`) in the same visual weight as the value itself — not as fine print.
- `vision_downgrade_blocked: true` events are shown to the user in plain language: *"Our safety check flagged this as urgent even though the photo analysis suggested otherwise — please treat this as urgent."*
- Facility capacity/medicine-stock data (FR-12) always shows a **"last updated: [timestamp]"** label — never presented as live.

## 6. Data Privacy Rules (DPDP Act 2023 alignment)

| Data category | Storage | Consent requirement | Ephemeral or persistent |
|---|---|---|---|
| Symptom text/voice during a single triage session | Session-only unless FR-9 opt-in | None for anonymous triage | Ephemeral |
| Longitudinal patient record (FR-9) | `patient_records` / `patient_events` tables | **Explicit opt-in**, logged as a consent event with timestamp and consenting party (patient or guardian, recorded by the ASHA) | Persistent, deletable on request |
| ASHA field capture photos | On-device only during OCR/extraction; not retained after field extraction unless the ASHA explicitly attaches it to a record | Implicit in ASHA's professional duty, but the *patient* must be informed per DPDP | Ephemeral by default |
| Demographic hash (phone + DOB hash) | Used as the patient-matching key instead of Aadhaar/government ID | N/A (hash is one-way; not raw PII) | Persistent (it's the join key) |
| Auth credentials | `password_hash` (BCrypt) only, never plaintext | Standard account creation consent | Persistent |
| Aggregate dashboard data (FR-13) | Pre-computed, de-identified counts only — no patient-level drill-down without separate ADMIN + audit-logged access | N/A (aggregate) | Persistent |

**Right to erasure:** a patient (or their ASHA on their behalf) can request deletion of their `patient_records`/`patient_events` rows; this is a hard delete, not a soft-delete flag, to genuinely satisfy DPDP's erasure principle rather than just hiding the row.
