# Principles of AI
## SwasthyaSetu AI — Foundational AI Design Philosophy

---

## 1. Purpose of This Document

This document defines *how* SwasthyaSetu AI's artificial intelligence components must be designed and behave, independent of the specific model or provider used. It is the philosophical foundation that the AI Ethics & Guardrails document translates into concrete rules and system controls.

---

## 2. Core Principles

### Principle 1 — Decision Support, Never Diagnostic Authority
The AI's role is to **narrow options and surface urgency**, never to issue a definitive medical diagnosis or prescription. Every AI output is framed as guidance toward a human point of care (ASHA worker, informal provider, PHC/CHC doctor), never as a replacement for one. This directly follows the research finding that even trained informal providers benefit most from *decision-support checklists*, not autonomous diagnostic tools.

### Principle 2 — Deterministic Safety Overrides Probabilistic Intelligence
Wherever a probabilistic AI/LLM component and a deterministic rule-based clinical-safety layer disagree, **the rule-based layer always wins**. Emergency/red-flag detection is never left solely to a language model's judgment. This is a non-negotiable architectural principle, not a configurable setting.

### Principle 3 — Low-Resource-First Design
Every AI component must be evaluated for feasibility on constrained hardware (2GB RAM, ~100MB app budget) and constrained connectivity (offline-first). An AI capability that only works with a stable broadband connection and a flagship device is treated as **not viable** for this product, regardless of how impressive its accuracy is in ideal conditions.

### Principle 4 — Linguistic and Literacy Equity
The AI must meet users in their own language and communication mode — voice-first, regional-language-native, and functional for non-literate or low-literate users. English-only or text-only AI interaction is treated as a failure of accessibility, not a minor limitation.

### Principle 5 — Privacy by Design, Not Privacy by Policy
Wherever architecturally possible (Stage 2, on-device engine), sensitive symptom, voice, and image data is processed **on the device itself** and never transmitted unencrypted or retained on third-party servers. Privacy is a design constraint from the first line of code, not a bolt-on compliance step.

### Principle 6 — Affordability-Aware, Not Just Symptom-Aware
Every AI-assisted recommendation must terminate in an actionable, cost-transparent next step (a specific facility, a specific pharmacy, an estimated OOPE) — never a vague "consult a doctor" that leaves the user to independently navigate schemes and pricing. This is the product's core AI differentiator versus incumbents like Practo or Ada.

### Principle 7 — Transparency and Explainability
Users and ASHA workers must be able to understand *why* the system recommended a given urgency tier or facility — e.g., "recommended because you reported [symptom], which matches our [protocol]" — not an opaque black-box output. This builds trust with a first-time, skeptical user base.

### Principle 8 — Human-in-the-Loop by Default
ASHA workers, informal providers, and clinicians remain the final decision-makers. The AI augments their workflow (auto-filling forms, suggesting checklists, flagging urgency) but every clinically consequential action requires human confirmation before being finalized.

### Principle 9 — Continuous Field-Grounded Validation
AI behavior (especially the triage safety layer) must be validated against real clinical protocols and, where possible, real field conditions — not assumed correct from benchmark performance alone. This reflects the research finding that even trained providers' *systemic* behaviors (e.g., over-prescription tied to revenue models) don't change without structural, not just informational, intervention — the AI must be honest about what it can and cannot fix.

### Principle 10 — Fail Safe, Not Fail Silent
When the AI is uncertain (low confidence, ambiguous symptom input, unsupported language), the system must **default to the most conservative safe action** (e.g., recommend in-person consultation) rather than guessing or failing without explanation.

---

## 3. How These Principles Map to the Product

| Principle | Product Manifestation |
|---|---|
| Decision support, not diagnosis | Triage Service outputs urgency tiers + routing, never a named diagnosis or drug prescription |
| Deterministic safety override | Rule-based red-flag layer wraps the LLM/on-device model (see System Architecture §4.1) |
| Low-resource-first | Stage 2 on-device model selection explicitly benchmarked against 2GB RAM / 100MB targets |
| Linguistic equity | Voice-first UX, i18next multilingual layer, native-script transcription |
| Privacy by design | On-device processing target (Stage 2), anonymized-only analytics (all stages) |
| Affordability-aware | Cost-Aware Routing Engine and OOPE calculator are mandatory outputs of every triage session |
| Transparency | Routing/triage results always shown with the reasoning symptom(s) that triggered them |
| Human-in-the-loop | ASHA record finalization always requires explicit worker confirmation before saving |
| Field-grounded validation | Phase 2 of the Roadmap explicitly includes clinical-mentor and field-user review |
| Fail safe | Ambiguous input → default to `CONSULT_SOON` tier, never a false "all clear" |

---

*This document is the philosophical foundation for the AI Ethics & Guardrails document, which defines the enforceable rules derived from these principles, and for the AI Training System document, which defines how a trained model is actually built and evaluated against these principles (e.g., emergency-recall as the top-priority metric under Principle 2, per-language evaluation under Principle 4).*
