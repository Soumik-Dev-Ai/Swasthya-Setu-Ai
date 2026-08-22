# AI Ethics, Restrictions & Guardrails
## SwasthyaSetu AI

---

## 1. Purpose

This document converts the Principles of AI into **enforceable rules, system controls, and hard restrictions**. Anything listed here is a build requirement, not a suggestion — the safety layer described here is what makes an AI-assisted rural health tool defensible to build at all.

---

## 1a. Applicability to the AI Training Workstream

Everything in this document applies with full force to the separate **AI Training System** workstream (owned by the AI/ML teammate) — training a model does not create an exemption from these rules. In particular:
- Training data must never include real, non-anonymized user-uploaded content (e.g., real insurance policies, real symptom sessions) without explicit consent (see §5).
- A trained model is *never* the final authority on an emergency classification, no matter how high its benchmark accuracy — the deterministic rule layer described in §3 always sits downstream of it (see AI Training System doc §2.3).
- A trained model must never be deployed without the emergency-recall evaluation described in the AI Training System document (§2.5) passing review.

## 2. Hard Restrictions (Non-Negotiable)

1. **The AI shall never generate a named medical diagnosis.** Output is restricted to urgency tiers (`EMERGENCY` / `CONSULT_SOON` / `SELF_CARE_ADVISORY`) and symptom-category descriptions, never "you have X disease."
2. **The AI shall never generate a medication name, dosage, or prescription.** Medicine-related output is restricted to routing (nearest PMBJP/AMRIT outlet) — never clinical dosing advice. This directly targets the research-identified failure mode of unnecessary/unsafe medicine dispensing.
3. **The AI shall never downgrade or suppress an emergency classification.** The deterministic red-flag rule layer has final authority; no LLM/model output can override an emergency escalation once triggered.
4. **The AI shall never fabricate facility, scheme, or pricing data.** All routing recommendations must be sourced from the curated/verified facility-scheme-pricing dataset — never generated or "guessed" by a language model.
5. **The AI shall never collect or process data beyond what is needed for the current session**, except where a user (or authenticated ASHA worker) has given explicit, informed consent to save a structured record.
6. **The AI shall never be presented as a substitute for a qualified professional or ASHA/CHC/PHC visit.** Every triage output includes a clear, plain-language disclaimer to this effect.

---

## 3. Escalation Protocol (Red-Flag Handling)

When the deterministic safety layer detects a red-flag symptom (e.g., chest pain, severe breathlessness, uncontrolled bleeding, signs of stroke, high fever with convulsion in a child, severe abdominal pain in pregnancy), the system must:
1. Immediately halt normal routing logic.
2. Display a clear, high-contrast, voice-read-aloud message directing the user to the nearest emergency facility or emergency contact number.
3. Log the event (anonymized) for later clinical-protocol review.
4. Never delay this message behind further AI-generated conversation or clarifying questions.

---

## 4. Bias & Equity Guardrails

- **Language bias:** The triage safety layer's red-flag checklist and clinical logic must be validated in *every* supported language independently — a translated UI string is not sufficient; the underlying NLU accuracy must be tested per language.
- **Literacy bias:** No workflow may require reading or typing as the *only* path to completion; voice and icon-based alternatives must exist for every critical action.
- **Geographic/data bias:** Routing recommendations must degrade gracefully (default to the nearest known public facility type) when granular local data is unavailable, rather than silently omitting a recommendation.
- **Socioeconomic bias:** The system must never implicitly favor private/paid care options over subsidized public options in its ranking logic — cost-minimization for the patient is a first-class ranking criterion, not an afterthought.

---

## 5. Data Privacy & Consent Guardrails

- **Consent-first:** No symptom, voice recording, image, or record is stored beyond the active session unless the user/ASHA worker explicitly opts in (e.g., "Save this record?").
- **Anonymization before aggregation:** Any data feeding the Admin/Analytics Dashboard must be stripped of direct identifiers before aggregation; the dashboard architecture should make it structurally impossible to view individual patient-level records.
- **On-device-first (Stage 2):** Voice and image data captured for ASHA digitization is processed on-device wherever the local AI engine is deployed; raw media is not uploaded to servers.
- **Regulatory alignment:** Data handling should be designed with awareness of India's Digital Personal Data Protection (DPDP) Act principles — purpose limitation, data minimization, and consent — even at prototype stage, so Stage 2 doesn't require a privacy re-architecture.
- **Right to human review:** Any user must be able to request that a human (ASHA worker/health official), not the AI, review a decision that affected them.

---

## 6. Human Oversight Requirements

- ASHA digitization records require explicit worker confirmation before being marked final/synced.
- Any change to the red-flag/emergency checklist logic requires review against an established clinical protocol source (WHO/Ministry of Health guidelines or equivalent), not just engineering judgment.
- The system is explicitly positioned to **upskill and support**, not replace, ASHA workers and informal providers — consistent with the research finding that informal providers already deliver 70%+ of rural primary care and are best served by augmentation, not displacement.

---

## 7. Misuse Prevention

- **No unauthorized clinical claims:** Marketing/UI copy must never claim diagnostic accuracy or clinical certification the system does not hold.
- **Anti-fraud posture:** Given the research finding on institutional PM-JAY fraud (₹114 crore in penalties across 2,842 hospitals), any future feature allowing users to report overcharging must log reports in a tamper-evident, auditable way, and must never let the AI auto-adjudicate a fraud claim — routed to a human authority only.
- **Rate-limiting/abuse controls:** Prevent automated/bulk misuse of the triage or routing APIs.

---

## 8. Audit & Accountability

- Every AI-influenced routing/triage decision (anonymized) is logged with: input symptom category, urgency tier assigned, which layer (rule-based vs. model) made the final call, and recommendation given.
- These logs support both **clinical protocol review** (are we escalating correctly?) and **fairness review** (are outcomes consistent across languages/regions?).

---

## 9. Do's and Don'ts Summary

| ✅ Do | ❌ Don't |
|---|---|
| Output urgency tiers and routing | Output named diagnoses |
| Route to pharmacies/facilities | Recommend specific medicines/dosages |
| Let rule-based layer override AI on emergencies | Let an LLM's confidence score override a red-flag rule |
| Default to conservative/safe action under uncertainty | Guess or provide a false "all clear" |
| Anonymize before any aggregation | Expose individual patient data on dashboards |
| Require human confirmation for ASHA records | Auto-finalize records without worker review |
| Disclose the reasoning behind a recommendation | Present AI output as an unexplained black box |
| Position the AI as support for ASHA/informal providers | Position the AI as a replacement for a health worker |

---

*This document operationalizes the Principles of AI document. Any new AI feature proposed for SwasthyaSetu AI — including any new trained model — must be checked against Sections 2–7 before being approved for build. See the AI Training System document for how these rules are enforced in the model training and integration pipeline.*
