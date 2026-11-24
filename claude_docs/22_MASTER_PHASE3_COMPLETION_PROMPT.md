# Document 22 — Master Phase 3 Completion Prompt (single, consolidated)

**Supersedes `20_PHASE3_GAP_CLOSURE_PROMPT.md`'s Phase A/Phase B split** — both decisions from that document are now resolved, so this is one sequential prompt, not a branching one. Paste everything in the fenced block below to your agent as a single task.

## Decisions going into this prompt

**Decision 1 (text-path Reasoning Engine):** proceeding with my original recommendation — **build it**, since it wasn't overridden. If you actually wanted the deterministic-only alternative, stop and say so before running this; item 6 below implements the build-it path.

**Decision 2 (pgvector vs JSON-vector): pgvector.** Reversing doc 20's "bless JSON-vector" recommendation, with real reasoning, not just deference to your preference:
- `03_SYSTEM_ARCHITECTURE.md` and `14_RAG_SYSTEM_DESIGN.md` always specified pgvector-on-Neon as the intended design — JSON-vector was an implementation-time shortcut, not the documented plan. Doc 20's recommendation to bless it was based on protecting a human team's limited hours; you've now told me agent-hours are cheap and you want the objectively best outcome, which is a different constraint and changes the answer.
- pgvector is genuinely free on Neon's free tier — this isn't a paid upgrade.
- Building on JSON now and migrating to pgvector later means doing the retrieval-store work twice. Building on pgvector now means doing it once.
- Neon was always meant to be your production database regardless of RAG — this completes something that should exist anyway, not new scope.

**One manual gate this creates:** you (not the agent) need an actual Neon project and its `DATABASE_URL` before item 5 below can run — same category of blocker as Colab/Kaggle access in `19_MANUAL_DATA_ACQUISITION_GUIDE.md`. If you don't have one yet: go to neon.tech, sign up free, create a project, copy the connection string into your `.env` as `DATABASE_URL`. Two minutes, no card required. Do this before running the prompt below, or the agent will correctly stop at item 5 and wait.

**API keys:** Groq and NVIDIA confirmed present. Gemini isn't mentioned — the cascade already degrades gracefully without it (`03_SYSTEM_ARCHITECTURE.md` §5), so this doesn't block anything, but confirm whether that's deliberate or just not yet added; three-provider redundancy was the original design intent.

**State scheme scope:** expanded to all 36 states/UTs via `21_state_scheme_registry.csv` and `download_state_schemes.py`. This is explicitly a **rolling, incremental task, not a blocker for the rest of Phase 3** — 17 of 36 have identified scheme names, 0 of 36 have verified official document URLs yet. Don't wait on this to run the prompt below; it proceeds independently.

---

## The prompt

```
Complete Phase 3 per the 2026-09-06 gap report, all decisions resolved. Run in
order, report per the existing doc 18 format after each item. Do not skip the
reported checkpoint after each item, even though this is one continuous task.

1. [Item C7] Swap embedding profile from `hash` to intfloat/multilingual-e5-small
   (pip install sentence-transformers). Re-run Phase 3 retrieval score calibration,
   record new floor/blend weights. Confirm multilingual retrieval parity tests
   (09_QA_TEST_PLAN.md) improve versus the hash baseline.

2. [Item B5] Remove the 24h vision-result cache — it conflicts with existing
   documented policy (04_AI_SAFETY_ETHICS.md §6, NFR-6). If this causes a
   measurable NFR-1 performance regression, report the specific number rather
   than silently re-adding caching.

3. [Item C6, version adjudication] Run iphs_chc.pdf (13.2MB) vs 02-CHC...pdf
   (8.8MB) through the automated recency resolution logic already built for
   the financial ETL pipeline (16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md
   §2.2 step 4). Resolve automatically if dates/supersession language are clear;
   otherwise flag needs_manual_confirmation and keep the corpus on whichever
   file was already in use. Report the outcome.

4. [Item C6, provenance + title] Attempt to reconstruct the origin of
   docs_raw/financial/unknown_financial_2026-02.pdf from any download log,
   commit history, or file metadata; exclude to docs_raw/_quarantine/ if
   origin can't be established (existing allow-list policy, not a new
   decision). Separately, confirm 9241546875_eng.pdf's actual title/content
   against the known WHO ETAT publication and rename per doc 19's convention
   if confirmed, or flag explicitly if it doesn't match.

5. [Item B4 — REQUIRES DATABASE_URL already set, see Decision 2 above] Migrate
   the retrieval store from JSON-in-process to pgvector on Neon: enable the
   pgvector extension, create the HNSW-indexed table per
   03_SYSTEM_ARCHITECTURE.md §3's original design, port the existing MVP
   corpus embeddings over, and confirm retrieval quality (recall@k,
   09_QA_TEST_PLAN.md) is at parity or better than the JSON baseline before
   considering this done — a migration that silently degrades retrieval
   quality is not actually complete. If DATABASE_URL is not set, stop here,
   report that this step is blocked on Neon provisioning, and continue to
   item 6 rather than blocking the whole prompt on it.

6. [Item A3 — building the text-path Reasoning Engine per Decision 1] Implement:
   non-red-flag text input → Knowledge Engine retrieval → Reasoning Engine
   (online backend, few-shot structured reasoning per 06_AI_MODEL_SPEC.md §6,
   extended to a text-input prompt variant analogous to the existing vision
   prompt) → mechanical grounding verifier → output. Reuse the existing
   verifier and grounding_reference contract exactly. Add adversarial and
   grounding tests for this path mirroring the existing vision-path coverage
   before calling it done.

7. [Item A1] With the confirmed Groq/NVIDIA keys (and Gemini if added): run
   one real image+symptoms request through the live vision cascade, confirm
   a valid grounding_reference is returned and passes the mechanical verifier.
   Then run one counter-test with a deliberately fabricated citation and
   confirm it's correctly rejected, collapsing to "uncertain."

8. [Item A2] Run one real financial ETL extraction pass over
   docs_raw/financial/cghs_rates_2024-01.pdf and HBP-2022.pdf. Confirm real
   rows land in government_costs with verbatim grounding quotes, correctly
   parsed dates, and correct recency resolution behavior.

After all 8 items: full test suite run (should still be 130+ tests, all green,
plus everything added in items 1 and 6), and a final summary of what changed,
what's still blocked (if item 5 was skipped on missing DATABASE_URL), and
which of the 19 documents in docs/ need a status-marker update as a result.
```

## What still runs independently, not blocking the above

- **State scheme registry completion** (`21_state_scheme_registry.csv`) — ongoing, incremental, not gating this prompt.
- If your agent has verified internet access, it can attempt filling in `official_portal_url` values in the registry itself and re-running `download_state_schemes.py` — spot-check whatever it finds, same caveat as everywhere else in this project.
