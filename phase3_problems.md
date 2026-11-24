# Phase 3 — Outstanding Items Blocking "Fully Complete"

**Date:** 2026-09-06
**Baseline:** Doc 18 Phase 3 scope judged against verified repo state (130 backend tests green, 3 consecutive runs). Companion artifacts: `phase0_reconciliation_report.md`, `CHANGELOG.md`.

This file lists — exactly and honestly — what separates "code-complete and test-green" from "fully implemented per the plan." Nothing here is aspirational; every item has a concrete closing action.

---

## A. Genuinely incomplete (blocks the "fully done" claim)

### 1. Live-provider grounding proof
- **Gap:** Every grounding test uses a *mocked* LLM. `test_vision_grounded_output_is_verified_and_passes` proves the machinery, not that Gemini/Groq/NVIDIA actually emit a valid `grounding_reference` in the field.
- **To close:** confirmed **non-production** API keys + a small live-call budget; then (a) one real image+symptoms request whose citation passes the mechanical verifier, and (b) a counter-test where a fabricated citation is correctly rejected and the signal collapses to `uncertain`. This is the Tier-C gate open since Phase 0.

### 2. ETL extraction has never run against a real LLM
- **Gap:** `run_financial_etl` is proven *without* keys (registers docs, extracts nothing, reports honestly). The actual path — prompt → candidate rows → quote verification → recency resolution — has only run through stubbed extractors.
- **To close:** sandbox LLM key; one real run over `docs_raw/financial/cghs_rates_2024-01.pdf` and `HBP-2022.pdf`; confirm real rows land in `government_costs` with verbatim quotes, parsed dates, and correct recency behavior.

### 3. The text-path Reasoning Engine doesn't exist (grounding wraps vision only)
- **Gap:** Non-red-flag *text* triage never calls an LLM at all — the deterministic v2 engine answers it — so doc 06 §6.1's RAG-grounded prompt only lives on the image path. Doc 15's architecture implies the reasoning cascade also serves text refinement.
- **To close (pick one):**
  - implement the text refinement call (safety gate → retrieval → LLM cascade → verifier) for non-red-flag inputs, **or**
  - amend docs 03/15 to state text triage is *intentionally* deterministic-only and RAG+reasoning applies to vision — arguably the stronger design, one line of doc work.

## B. Design decisions needing formal closure (not code)

### 4. pgvector deferred, not built
- **Gap:** Retrieval runs on JSON-stored vectors scored in-process. Correct at MVP scale (doc 14 §3's own guidance) — but Doc 18 Phase 3 item 1 says "enable pgvector on the existing Neon Postgres," and that Neon instance does not exist.
- **To close:** provision the free Neon tier and port the store (SQL cosine + HNSW index), **or** amend docs 14/18 to bless the JSON approach as the MVP design with a documented switchover trigger (~10k chunks).

### 5. Vision cache vs. doc 03 §16 conflict
- **Gap:** Docs say never cache patient images (privacy); code caches vision results 24h keyed by image SHA. Open since Phase 1.
- **To close:** one decision — drop the cache, or amend the doc with the privacy model.

## C. Data / provenance gaps (corpus quality, not code)

### 6. Corpus verification & dedup unfinished
- **Gap:** duplicate WHO/IPHS files in `docs_raw/`; `iphs_chc.pdf` (13.2 MB) vs `02-CHC...pdf` (8.8 MB) are *different versions* needing adjudication; `docs_raw/financial/unknown_financial_2026-02.pdf` has unverified provenance (violates doc 14's exclusion rule if ingested); `9241546875_eng.pdf` is likely the WHO ETAT manual but its title was never confirmed; the four state-scheme documents (JSY, PMNDP, HMDG, Chiranjeevi/WBHS) are still missing.
- **To close:** dedupe; verify each file's origin; rename with date-stamps (doc 19 convention); source or explicitly descope the state docs.

### 7. `hash` embedding profile is the default
- **Gap:** Retrieval works but is lexical-dominant; true multilingual semantic recall needs the real model.
- **To close:** `pip install sentence-transformers`, set `EMBEDDING_MODEL=intfloat/multilingual-e5-small`, re-run the Phase-3 score calibration, record the new floor/blend weights.

---

## What is NOT on this list (already proven green)

Ingestion idempotency (`document_registry` SHA-256 dedup), clause-level chunking, hybrid retrieval + calibrated abstention, the mechanical grounding verifier, hallucinated-citation rejection through cascade fallback, ETL recency/date/supersession logic + honest null dates, the `as_of` freshness label, migrations 0001–0003 (SQLite verified, Postgres DDL rendered), and the safety gate — **130 backend tests, 3 consecutive green runs, safety suite CI-gated.**

## Verdict

**Phase 3: CODE-COMPLETE AND TEST-GREEN; "FULLY DONE" IS GATED ON ITEMS A1–A2 (one sandbox-key afternoon), DECISIONS ON B4–B5, AND HOUSEKEEPING C6–C7.**
