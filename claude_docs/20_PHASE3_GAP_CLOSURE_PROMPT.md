# Document 20 — Phase 3 Gap Closure Prompt

**Source:** the 2026-09-06 gap analysis report (items A1–A2, A3, B4–B5, C6–C7). This document splits that report into what your agent can close today, what needs a decision from you first, and what needs data/access only you can provide.

---

## Before you run anything — two decisions and one access check

### Decision 1: Item A3 — does text triage get a Reasoning Engine path?

**My recommendation: yes, build it.** The original architecture (`03_SYSTEM_ARCHITECTURE.md` §4.1, `06_AI_MODEL_SPEC.md`, `15_AI_STRATEGY_UNIFIED.md`) always treated non-emergency refinement as something the cascade handles for *any* non-red-flag input, not image-only — and text is very likely your dominant input type in practice, since a rural user describing symptoms by voice/text is a more natural interaction than photographing something. Leaving text refinement purely deterministic-beyond-the-41-keywords means the RAG-grounded, guideline-cited reasoning your whole architecture suite was built around only ever fires for photos — which undersells the actual system you've designed. The report's "arguably the stronger design" framing for the deterministic-only alternative conflates *less hallucination-surface* with *better product*; but the 41-keyword gate already owns every actual hallucination risk that matters (true emergencies), so extending grounded reasoning to text doesn't reintroduce the risk that argument is protecting against — it just gives text inputs the same nuanced, cited severity reasoning image inputs already get.

**If you agree:** the prompt below implements it. **If you'd rather keep text deterministic-only** (e.g., for time), say so and I'll swap this section for the one-line doc amendment instead — tell me before running Phase A.

**RESOLVED (2026-09-06 follow-up):** pgvector confirmed as the choice — see `22_MASTER_PHASE3_COMPLETION_PROMPT.md` for the reasoning and the single consolidated prompt that supersedes the Phase A / Phase B split below. This document is kept for its Phase A content (still valid, still autonomous) and its historical reasoning; use doc 22 as the one prompt to actually run.

### Decision 2: Item B4 — pgvector now, or bless JSON-vector as MVP? — SUPERSEDED, see doc 22

**My recommendation: bless JSON-vector as the documented MVP design, don't provision pgvector yet.** `14_RAG_SYSTEM_DESIGN.md` §3 always said exact/in-process search is fine below a real scale threshold — your corpus (IMCI+ETAT+IMAI+IPHS+ICMR) is nowhere near the ~10k-chunk trigger point the report itself proposes. Provisioning Neon now for a problem you don't have yet is exactly the kind of scope-add this whole suite has been trying to avoid.

**One thing to confirm regardless of this decision:** does a Neon Postgres instance exist for the project *at all* (production DB, independent of RAG)? `03_SYSTEM_ARCHITECTURE.md` always specified Neon as the production database generally, not just for vectors — if the answer is "no Neon instance exists anywhere yet," that's a separate, pre-existing gap worth knowing about regardless of what you decide on pgvector specifically.

### Access check: API keys for A1/A2

Both live-grounding proof and the real ETL run need working Gemini/Groq/NVIDIA NIM keys in the environment — confirm these exist and are free-tier (no billing surprise) before running Phase B below. If you don't have them yet, get them first; nothing else in this document unblocks that for you, the same way Colab/Kaggle access couldn't be automated in `19_MANUAL_DATA_ACQUISITION_GUIDE.md`.

---

## What's autonomous right now, no input needed (Phase A)

Paste this to your agent to run immediately — none of it is blocked:

```
Close the following Phase 3 gaps from the 2026-09-06 report. Run in this order,
report results per the existing doc 18 reporting format after each item.

1. [Item C7] Swap the embedding profile from `hash` to a real multilingual model:
   pip install sentence-transformers, set EMBEDDING_MODEL=intfloat/multilingual-e5-small,
   re-run the Phase 3 retrieval score calibration, record the new floor/blend weights.
   Confirm multilingual recall test cases (09_QA_TEST_PLAN.md, multilingual retrieval
   parity) improve versus the hash-based baseline, not just that the model loads.

2. [Item B5] Bring the vision cache into compliance with already-documented policy.
   04_AI_SAFETY_ETHICS.md §6 and NFR-6 (02_PRD.md) already establish no unconsented
   PII retention beyond active session — the 24h image-hash cache conflicts with this
   existing policy, not an undecided question. Remove the cache. If removing it causes
   a measurable performance regression outside NFR-1's targets, report that specifically
   rather than silently re-adding caching — that would be a new tradeoff to surface, not
   something to resolve unilaterally.

3. [Item C6, partial — version adjudication] For iphs_chc.pdf (13.2MB) vs
   02-CHC...pdf (8.8MB): run these two files through the same automated recency
   resolution logic built for the financial ETL pipeline (16_INTENT_ROUTING_AND_
   GOVT_FINANCIAL_PIPELINE.md §2.2 step 4) — extract effective/publication dates
   and any supersession language from each, resolve automatically if the dates
   or supersession claims are clear. If genuinely ambiguous (same date, no
   supersession language, or conflicting metadata), do NOT guess — flag both
   files as needs_manual_confirmation and keep the corpus on whichever was
   already in use. Report which outcome occurred.

4. [Item C6, partial — provenance] Attempt to reconstruct the origin of
   docs_raw/financial/unknown_financial_2026-02.pdf from any available download
   log, commit history, or file metadata. If origin cannot be established,
   exclude it from the corpus per the existing allow-list-only rule
   (14_RAG_SYSTEM_DESIGN.md §1, 16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md
   §2.1) — this is applying existing policy, not a new decision. Report which
   outcome occurred and, if excluded, move it to a clearly labeled
   docs_raw/_quarantine/ folder rather than deleting it outright, in case its
   origin becomes identifiable later.

5. [Item C6, partial — title verification] Confirm 9241546875_eng.pdf's actual
   title and content against the known WHO ETAT publication (ISBN/title should
   be verifiable from the PDF's own title page or metadata). Rename to match
   doc 19's naming convention once confirmed. If the content doesn't match what
   doc 19 describes as the ETAT manual, flag this explicitly rather than
   renaming it to fit the assumption.

After all 5 items, produce a summary: what changed, test evidence for each,
and confirm the existing 130-test suite is still fully green plus any new
tests added for the multilingual recall check in item 1.
```

## What runs once you've confirmed the two decisions and API key access (Phase B)

```
Proceed only after [Decision 1], [Decision 2], and API key access are confirmed.

6. [Item A3, if Decision 1 = build it] Implement the text-path Reasoning Engine:
   non-red-flag text input → Knowledge Engine retrieval → Reasoning Engine
   (online backend, few-shot structured reasoning per 06_AI_MODEL_SPEC.md §6,
   extended to a text-input prompt variant analogous to the existing vision
   prompt) → mechanical grounding verifier → output. Reuse the existing
   verifier and grounding_reference contract exactly — this should not
   require new verification logic, only a new prompt path feeding the same
   downstream pipeline the vision path already uses. Add adversarial and
   grounding tests for this path specifically before calling it done, mirroring
   the existing vision-path test coverage.

   [Item A3, if Decision 1 = deterministic-only] Instead: amend
   03_SYSTEM_ARCHITECTURE.md §5 and 15_AI_STRATEGY_UNIFIED.md §1/§3 to state
   explicitly that text triage refinement is intentionally deterministic-only,
   with the Reasoning Engine's grounded-reasoning path applying to vision
   input specifically. State the reasoning (not just the decision) in both
   documents so a future reader understands this was a considered choice.

7. [Item B4, if Decision 2 = bless JSON-vector] Formally document the
   JSON-vector approach in 14_RAG_SYSTEM_DESIGN.md §3 as the confirmed MVP
   design, with the ~10k-chunk switchover trigger stated explicitly as a
   monitored threshold, not an assumption. No code change needed.

   [Item B4, if Decision 2 = provision pgvector now] Requires you to create
   the free Neon Postgres project yourself and supply DATABASE_URL — this
   step cannot run until that connection string exists. Once supplied,
   migrate the retrieval store to pgvector with HNSW indexing per the
   original 03_SYSTEM_ARCHITECTURE.md §3 design.

8. [Item A1] With confirmed API keys: run one real image+symptoms request
   through the live vision cascade, confirm a valid grounding_reference is
   returned and passes the mechanical verifier. Then run one counter-test
   with a deliberately fabricated citation and confirm it's correctly
   rejected, collapsing to "uncertain" rather than passing through.

9. [Item A2] With confirmed API keys: run one real financial ETL extraction
   pass over docs_raw/financial/cghs_rates_2024-01.pdf and HBP-2022.pdf.
   Confirm real rows land in government_costs with verbatim grounding quotes,
   correctly parsed dates, and correct recency resolution behavior — not
   just that the pipeline runs without erroring.

Report per item, same format as Phase A.
```

## What still needs you directly, not the agent (Item C6 remainder)

The four state-scheme documents (JSY, PMNDP, HMDG, Chiranjeevi/WBHS) are still missing from the corpus. Same situation as WHO IMAI and the IPHS files earlier in this project: either confirm your Claude Code session has verified internet access and let it attempt these itself (spot-check what it finds, same caveat as `19_MANUAL_DATA_ACQUISITION_GUIDE.md` §1.1), or tell me which state schemes to prioritize and I'll track down verified official URLs the way I did for IPHS/ICMR/IMAI.
