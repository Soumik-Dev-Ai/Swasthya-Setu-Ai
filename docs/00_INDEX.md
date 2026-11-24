# SwasthyaSetu AI — Engineering Documentation Suite (v2)
**Target:** SIH 2026, Problem Statement SIH26133 (Govt. of Maharashtra) — *Accessibility and quality of public healthcare services, particularly in rural and underserved areas*
**Status key used throughout this suite:** 🟢 EXISTING (built in v1 prototype) · 🟡 EXTEND (v1 exists, needs work for SIH26133) · 🔴 NEW (not started — SIH26133 gap-closure)

## What changed from v1 of this suite
This is a deepened, audited version. It adds a genuine flaw audit (doc 1), fixes the specific issues that audit surfaced (refresh tokens, CORS allow-list, safety-override logging, CI-gated safety tests), and completes the three documents that weren't finished yet (data catalog, roadmap, QA plan). It does **not** throw away the working architecture from v1 — see doc 1 §1.3 for exactly what was kept and why.

## What changed in this update
`15_AI_STRATEGY_UNIFIED.md` is now the canonical, single-page reference for the AI architecture — the "Knowledge Engine + Reasoning Engine" pattern, with two corrections needed to keep it buildable for free: the Financial Spot is deliberately excluded from the RAG+reasoning pattern (it already has something stronger — a deterministic lookup), and "the fine-tuned model" is two backends sharing one contract (a genuinely fine-tuned offline edge model, and a few-shot-prompted online hosted cascade, since the hosted providers can't be fine-tuned for free). Docs 3, 6, 12, 13, and 14 have been updated to cross-reference doc 15 rather than restate the architecture independently. Docs not listed here (1, 2, 4, 5, 7, 8, 9, 10, 11) are unaffected by this update — their content doesn't depend on which engine produces a triage classification, only on what the classification is used for.

## Documents in this suite
1. `01_AUDIT_KEEP_KILL.md` — Old Prototype Audit: flaws, feature gaps, keep/kill decisions
2. `02_PRD.md` — Product Requirements Document
3. `03_SYSTEM_ARCHITECTURE.md` — System Architecture Document (incl. ER diagram, CI/CD, env vars, auth matrix, CORS, cache strategy)
4. `04_AI_SAFETY_ETHICS.md` — AI Principles & Ethics Guardrails
5. `05_FRONTEND_SPEC.md` — Frontend Product Specification
6. `06_AI_MODEL_SPEC.md` — AI Training & Model Specification
7. `07_DATA_CATALOG.md` — Data Sources & Dataset Catalog
8. `08_ROADMAP_EXECUTION_PLAN.md` — Development Roadmap, Risk Register & Demo Script
9. `09_QA_TEST_PLAN.md` — Testing & Quality Assurance Plan
10. `10_PPT_GENERATION_PROMPT.md` / `11_PPT_GENERATION_PROMPT_V2.md` — self-contained prompts for generating the official SIH 2026 6-slide PPT content (v2 supersedes v1)
12. `12_AI_RELIABILITY_HARDENING_PLAN.md` — anti-hallucination hardening plan for the Cost Analyzer and AI Symptom Detector
13. `13_FINE_TUNING_TRAINING_PLAN.md` — fine-tuning plan for the on-device edge model, with the statistical validation requirements spelled out
14. `14_RAG_SYSTEM_DESIGN.md` — clinical RAG system: curated source corpus, ingestion, retrieval, grounding verification, and integration into the existing cascade
15. `15_AI_STRATEGY_UNIFIED.md` — **canonical AI architecture reference** — read this first for any AI-related question, then follow its links into docs 3/6/12/13/14 for depth
16. `16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md` — Intent Classifier design + government-only financial data ETL pipeline (mechanically verified, not query-time RAG)
17. `17_HEALTHCARE_COST_RESEARCH_BIBLIOGRAPHY.md` — verified academic/government sources on Indian healthcare costing, for validating the curated database and citing in the pitch — not for fine-tuning
18. `18_MASTER_BACKEND_IMPLEMENTATION_PROMPT.md` — paste into a coding agent (with repo + docs folder access) to reconcile the real codebase against this suite and build the remaining scope, phase by phase
19. `19_MANUAL_DATA_ACQUISITION_GUIDE.md` — what falls to you personally vs. your coding agent (source PDFs, fine-tuning execution)
20. `20_PHASE3_GAP_CLOSURE_PROMPT.md` — superseded by doc 22 for execution; kept for its Phase A content and decision reasoning
21. `21_state_scheme_registry.csv` — all 36 states/UTs, scheme names identified where found, official URLs populated as verified (rolling, incremental)
22. `22_MASTER_PHASE3_COMPLETION_PROMPT.md` — **the one prompt to actually run** to close out Phase 3, all decisions resolved
23. `23_COMPLETE_FINETUNING_TRAINING_GUIDE.md` — **fully self-contained** — the entire fine-tuning/training process end-to-end in one file, including every Claude Code prompt needed, readable standalone without the rest of this suite
24. `24_ENVIRONMENT_AWARE_MODEL_INTEGRATION.md` — structurally prevents the fine-tuned model from ever loading in the cloud deployment, while keeping it usable for local dev/testing
25. `25_FEATURE_UPDATE_INSURANCE_FACILITY_JWT.md` — JWT hardening, scheme registration portal links, Google Maps direction buttons, Kolkata facility coverage expansion (governed sourcing, not live scraping)
26. `26_AUTONOMOUS_SOURCE_MONITORING_FRAMEWORK.md` — unified, autonomous, change-triggered refresh system replacing fixed quarterly cadences across all data sources — never publishes unverified, never fails silently
26. `26_DYNAMIC_CHANGE_DETECTION_REFRESH.md` — replaces fixed quarterly refresh with change-detection-triggered updates across all governed pipelines, with the one deliberate exception (safety-gate logic never auto-updates)

## How to read this suite
- **Read doc 1 first**, always — it's the honest starting point everything else is built from.
- **Read doc 15 for the AI architecture specifically** — it's the single source of truth for how the Knowledge Engine and Reasoning Engine fit together, and links out to the detailed docs rather than requiring you to reconcile them yourself.
- Start with `02_PRD.md` if you're deciding *what* to build.
- Start with `03_SYSTEM_ARCHITECTURE.md` if you're deciding *how* to build it.
- `08_ROADMAP_EXECUTION_PLAN.md` is the single source of truth for "what do I work on this week."
- Every FR, module, and dataset uses the same status markers above — if it says 🔴 NEW, it does not exist in the codebase yet, no matter how confidently a diagram elsewhere implies otherwise.

## Non-negotiable constraints baked into every document
- ₹0 budget — free tiers only (Vercel, Render, Neon.tech, Gemini/Groq/NVIDIA NIM free tiers, GitHub Actions free-tier CI).
- No hardware builds.
- No live ABDM/PM-JAY production API access, no government data-sharing MoUs — anything that looks like "government integration" is built to a public, standards-shaped schema, never a gated live feed.
- No paywalled/credentialed medical datasets.
- Buildable by 6 college students in 4–6 weeks on top of the existing prototype.
