# Document 12 — AI Reliability & Anti-Hallucination Hardening Plan
**Scope:** The Financial Spot (Cost & Scheme Analyzer) and the Accessibility Spot (AI Symptom Detector) — the two features in your four-spot framework that involve probabilistic AI rather than pure agentic logic.

**Architecture note:** this document predates and now feeds into `15_AI_STRATEGY_UNIFIED.md`, which is the canonical reference for how these pieces fit together as the Knowledge Engine / Reasoning Engine pattern. Part B's RAG-grounding recommendation (§B.2) is what `14_RAG_SYSTEM_DESIGN.md` and doc 15 build out in full — nothing in this document is superseded, it's the reliability rationale underneath the architecture doc 15 formalizes.

---

## 0. What "doesn't hallucinate" can honestly mean

Before the plan: current research is consistent on one point. Even the best-grounded systems built in 2026 don't claim zero hallucination for anything a language model generates freely — the current leading benchmark for straightforward document summarization still puts the best major model's hallucination rate at roughly 3%, and that's on a far simpler task than financial or clinical reasoning. Grounding techniques remove the specific failure mode of a model inventing a fact from nothing, but they don't remove every source of error — retrieval can miss the right document, two sources can genuinely disagree, a citation can be misapplied.

So the honest target for this plan is not "the AI never hallucinates." It's this:

> **Every decision that touches money or clinical severity is made by a code path that either (a) contains no LLM at all, and is therefore mathematically incapable of hallucinating, or (b) contains an LLM whose output is grounded, structurally constrained, cross-checked against a deterministic source, and defaults to abstention rather than a guess whenever any of those checks fail.**

This is a stronger, more auditable claim than "it doesn't hallucinate," and it's the one you can actually defend to a judge, a clinical mentor, or a real user.

## 1. The shared architectural principle

Both features already follow the right shape at a high level: a deterministic path does the actual deciding, and AI is only ever a secondary refinement or extraction step, never the source of truth. The hardening work below is about making that boundary airtight in the specific places it currently isn't (mainly: the cost-estimate scrape fallback, and the LLM refinement tier of triage) rather than changing the overall architecture.

---

## Part A — The Financial Spot: Cost & Scheme Analyzer

### A.1 Current design and where the real risk lives

- Scheme eligibility (8 schemes) is already fully rule-based — no LLM anywhere in that decision. **This path is already true-zero-hallucination by construction**, provided the rules themselves are correctly coded and tested (a correctness problem, not a hallucination problem — see A.4).
- Cost estimation's primary path is a curated, human-reviewed dataset lookup — also already true-zero-hallucination by construction.
- **The entire residual risk sits in the web-scrape + LLM-extraction fallback path**, gated behind `ENABLE_WEB_SCRAPE` and currently off by default. This is the one component in the whole platform where an LLM could, in principle, state a rupee figure that isn't real. Treat it accordingly.

### A.2 Recommendation: reconsider whether this fallback belongs in the SIH build at all

**Update:** `16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md` Task 2 now specifies exactly this — how to keep government cost/scheme data dynamic without a query-time generative step. That document is the concrete implementation of the recommendation below; read it for the actual pipeline design.

The single highest-leverage decision here is not a technique, it's a scope call: **the fallback path provides the least value and carries the most risk of anything in the system.** For a hackathon demo specifically, "no estimate available" is a more defensible answer than a community-estimate figure a judge could screenshot and later find wrong. If the fallback isn't load-bearing for your demo narrative, cut it from the SIH-facing build and keep it as a documented, disabled, post-hackathon research direction. If you do keep it, everything below is mandatory, not optional.

### A.3 If the fallback stays: the grounding/verification stack to apply

Current financial-AI research (2026) converges on the same core move for exactly this situation — never let the model both find *and* state a number; force it to point at the number, then verify the pointer mechanically, outside the model:

1. **Double-lock grounding.** Require the extraction step to return a `grounding_quote` — the exact verbatim substring from the retrieved source text that contains the figure — alongside the number itself. Then, in ordinary code (not another LLM call), check that the quote exists character-for-character in the source. If it doesn't match, reject the extraction outright rather than accepting a paraphrase. This single check eliminates outright-invented numbers by construction, because there's no longer a text-generation step where a plausible-but-nonexistent figure can survive to the user.
2. **Semantic metric grounding (prevents "phantom metrics").** A subtler failure than an invented number is a *real* number attached to the *wrong* procedure name. Check that the tokens in the claimed metric name (e.g., "cataract surgery cost") meaningfully overlap with tokens in the source chunk the number came from; reject low-overlap matches as a likely mismatch rather than accepting them.
3. **The model proposes, the deterministic layer confirms.** This is the one-line design rule from current financial-AI implementation guides, and it's already partially true in your architecture (curated DB first) — extend the same rule to the fallback path: the LLM's extracted figure is never the final answer, only a candidate that must clear the two mechanical checks above before it's shown at all.
4. **Never let the UI present an unverified figure with the same visual weight as a verified one.** This is already specified in your ethics/frontend docs (the `community_estimate_unverified` tag) — the hardening addition is that this tag should be paired with a visibly different visual treatment (not just a text label), since a judge or a rural user skimming quickly should not be able to mistake it for a confirmed number.

### A.4 Correctness testing for the deterministic path (not a hallucination risk, but equally "wrong answer = harm")

The scheme-eligibility and cost-lookup logic being deterministic means it can't hallucinate — but it can still be *wrong* due to an ordinary logic bug, and a wrong deterministic answer is just as harmful as a hallucinated one to the family relying on it. Treat this with equal rigor:

- **Property-based/fuzz testing** (e.g., a Hypothesis-style testing library) across the full input space of every eligibility rule — income values exactly at a threshold boundary, just above and just below it, multiple simultaneously-qualifying categories, zero/negative/extreme demographic inputs — rather than only hand-picked example test cases.
- **Data provenance audit trail:** every curated cost-DB entry carries a `verified_against` field naming the exact source document/section it was extracted from, plus the resolution method that confirmed it's current — an explicit, mechanically-verified supersession reference, or a compared effective date (`16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md` §2.2, automated, no human reviewer required). This is a lightweight addition that turns "we curated this" into "here's the paper trail," which matters if a judge asks how a number was derived.

### A.5 What this achieves
Curated-DB and scheme-matching paths: **true zero hallucination, by construction — no LLM in the decision at all.** Scrape-fallback path (if kept): **bounded risk — every figure is either mechanically verified against its source or discarded, never guessed.**

---

## Part B — The Accessibility Spot: AI Symptom Detector

### B.1 Current design and where the real risk lives

- The deterministic 41-keyword safety gate is **already true-zero-hallucination for anything it's designed to catch** — it contains no LLM, so it cannot hallucinate a red flag it correctly detects.
- Its residual risk is a **coverage gap**, not a hallucination: a genuine emergency phrased in a way the keyword list doesn't include. This is addressed by expanding and continuously red-teaming the keyword corpus (Part B.6), not by AI reliability techniques.
- **The actual hallucination risk lives entirely in the LLM cascade's refinement role** for cases the deterministic gate doesn't flag — i.e., cases where the AI is asked to reason about severity or produce a supporting classification.

This is not a theoretical risk category. In early 2025, a documented case in Hyderabad, India involved a kidney-transplant patient who discontinued antibiotics after receiving a misleading AI-generated response, contributing to the loss of the transplanted organ — a real, cited example of exactly the failure mode this section exists to prevent.

### B.2 Ground the refinement tier in retrieved guidelines, not open generation

Current clinical-AI research is consistent: retrieval-augmented generation, where the model reasons over retrieved excerpts of an authoritative source (WHO IMCI/ETAT guidelines, in your case) rather than generating from parametric memory, is the single most effective lever for reducing clinical hallucination — it turns the task from "recall a fact" into "find a fact and report it faithfully," which is narrower and far more checkable. Concretely: retrieve the relevant IMCI/ETAT severity-criteria excerpt for the symptom category being classified, include it in the prompt as required context, and instruct the model to ground its classification in that excerpt specifically rather than general medical knowledge.

### B.3 Structured output as a hard constraint, not just a validated convention

Your existing design already specifies a strict JSON output shape with reject-on-malformed-output. Strengthen this from "validated after generation" to "structurally enforced during generation" by adopting a constrained-decoding approach (a JSON-schema-constrained generation library, or your chosen provider's native structured-output mode where available) so an out-of-schema `severity_signal` value is not just caught, it's impossible to produce in the first place.

### B.4 Cross-model agreement: a real signal, but a weaker one than it looks — use it honestly

Your 3-provider cascade already gives you the raw material for cross-model agreement checks on ambiguous cases. Recent research is an important caution here, though: **agreement between models is not the same as correctness.** Models can agree with each other because they share a training-data bias, a memorized heuristic, or a similar blind spot — not because they're right — and this effect is documented as worse, not better, on the most "confident"-sounding frontier models specifically. The honest way to use this signal:

- Treat agreement between 2+ providers as a reason to **raise** confidence modestly, never as sole justification on its own.
- Treat **disagreement** between providers as a hard trigger to escalate to a more cautious tier — this direction of the rule is much more trustworthy than the "agreement lowers caution" direction, and costs you nothing extra since your cascade already makes multiple calls.
- Never let agreement alone downgrade a classification toward "routine" — only the deterministic gate's absence of a red flag, plus a calibrated confidence check (B.5), should permit that.

### B.5 Confidence calibration, done for real

This was flagged as a gap in your earlier audit (`01_AUDIT_KEEP_KILL.md` #5) — this plan makes it concrete:

1. Build a held-out, clinically-labeled test set (ideally with input from your roadmap's Clinical Mentor Review phase).
2. Bucket the cascade's reported confidence into deciles (0.0–0.1, 0.1–0.2, ... 0.9–1.0) and measure actual accuracy within each bucket.
3. Where reported confidence overstates real accuracy for a bucket by more than roughly 15 percentage points, either apply a standard recalibration technique (e.g., Platt scaling / temperature scaling) or simply clip that provider's usable confidence ceiling in production — don't trust an uncalibrated number just because the model reports it fluently.
4. Recalibrate after any provider model version changes (B.7) — calibration is not a one-time task.

### B.6 A codified, auditable abstention policy

Define a single decision table, not implicit prompt behavior: below a specific calibrated-confidence floor, the system's output is **always** "consult soon," never "routine," full stop. This becomes a literal, testable rule in the codebase rather than something that emerges from prompt wording — and it's the direct AI-layer analogue of the deterministic gate's "fail toward caution" principle already established in `04_AI_SAFETY_ETHICS.md`.

### B.7 Adversarial testing, expanded

Extend the existing 100+ phrase adversarial suite with categories specifically chosen to probe LLM reasoning failure modes rather than just keyword-matching failure modes:
- **Negation/hedging language** — "I don't think it's serious but I have chest pain," where a naive model might anchor on the hedge rather than the symptom.
- **Multilingual paraphrase and transliteration attacks** — the same red flag expressed in a way the training data underrepresents (Hindi written in Latin script, regional dialect phrasing).
- **Code-switched sentences** — Hindi/English or Bengali/English mixed mid-sentence, which is genuinely how many users will type.

### B.8 Model version pinning and drift monitoring

Free-tier hosted models can be updated by the provider without notice, silently changing behavior underneath you. Pin exact model IDs/versions wherever the provider allows it, and — critically — **re-run the full adversarial safety suite against the live provider endpoint before every deployment and before the actual demo**, not just once during development. A provider-side update between your last test run and demo day is a real, underappreciated risk specific to free-tier API dependencies.

### B.9 Human-in-the-loop, made specific rather than aspirational

Your roadmap already includes a "Clinical Mentor Review" phase — make it concrete for this plan: the mentor reviews a **stratified** sample of triage outputs weighted toward borderline/ambiguous cases (not a random sample dominated by easy, obviously-correct ones), and formally signs off before the SIH demo. This is the step that converts "we designed it to be safe" into "a clinician checked our actual outputs."

### B.10 What this achieves
Deterministic gate: **true zero hallucination for anything within its keyword coverage, by construction.** LLM refinement tier: **bounded risk — grounded in retrieved guidelines, structurally constrained, cross-checked (honestly, not overclaimed), calibrated, defaulting to caution under any uncertainty, tested against realistic adversarial inputs, and monitored for silent provider drift.**

---

## Part C — Cross-Cutting Anti-Patterns (what NOT to do)

- **Don't fine-tune on synthetic, self-generated data** to try to reduce hallucination — this can bake in and amplify existing model biases rather than removing them, and your team's free-tier compute budget makes rigorous validation of a fine-tune impractical to do safely in the first place. Grounding and constraint, not fine-tuning, are your actual budget-compatible levers.
- **Don't treat model confidence as evidence of correctness** — the calibration research is blunt that this specifically gets worse, not better, after typical post-training on some models. Trust your own calibration curve (B.5), not the model's self-reported number.
- **Don't let cross-model agreement alone justify moving toward a less cautious classification** (B.4) — only use it to move toward more caution.
- **Don't display an unverified financial or clinical figure with the same visual weight as a verified one**, anywhere in the product.

## Part D — Test suite additions (append to `09_QA_TEST_PLAN.md`)

| New test category | What it checks |
|---|---|
| Grounding-quote verification | Every scrape-fallback cost figure's `grounding_quote` mechanically matches the source text; reject if not |
| Phantom-metric rejection | A cost figure attached to a mismatched procedure name is rejected, not displayed |
| Eligibility boundary fuzzing | Property-based test sweep across every scheme's income/category thresholds |
| Confidence calibration audit | Reported confidence vs. actual accuracy per decile, on the held-out clinically-labeled set |
| Cross-model disagreement escalation | A case with genuine 3-provider disagreement always escalates tier, never resolves to "routine" |
| Hedging/negation adversarial set | New adversarial phrases specifically testing negation and hedged language |
| Live-provider drift regression | Full adversarial suite re-run against the live provider endpoint, scheduled before every deploy and before the demo specifically |

## Part E — Honest Scorecard (safe to show a judge as-is)

| Component | Contains an LLM? | Hallucination status |
|---|---|---|
| Deterministic safety gate (41 keywords) | No | **True zero hallucination**, by construction. Residual risk is keyword coverage, addressed by ongoing red-teaming, not an AI-reliability technique. |
| Scheme eligibility matcher (8 schemes) | No | **True zero hallucination**, by construction. Residual risk is ordinary code correctness, addressed by fuzz testing. |
| Curated cost/disease dataset lookup | No | **True zero hallucination**, by construction. Residual risk is data-entry accuracy, addressed by the provenance audit trail. |
| Cost-estimate scrape fallback (if kept) | Yes | **Bounded risk** — every figure mechanically verified against source text before display, or rejected. Recommend cutting from the SIH demo build (A.2). |
| LLM triage refinement tier | Yes | **Bounded risk** — grounded in retrieved guidelines, structurally constrained, calibrated, defaults to caution, tested adversarially, monitored for drift. Not zero, and no honest claim should say otherwise. |

## Further Reading (paper titles for the team to look up directly — not reproduced here beyond title/topic)

- *Mitigating LLM Hallucinations through Domain-Grounded Tiered Retrieval* (2026)
- *When LLMs Agree, Are They Right? Auditing Self-Consistency and Cross-Model Agreement as Confidence Signals* — the cross-model-agreement caution cited in B.4
- *FinGround: Detecting and Grounding Financial Hallucinations via Atomic Claim Verification* (2026) — source of the double-lock/semantic-metric grounding pattern in A.3
- *VeriFin: A Neurosymbolic Framework for Verifying LLM-Generated Financial Claims* (2026)
- *Trust but Verify: Mitigating Medical Hallucinations via Post-Hoc Adversarial Auditing and Multi-Agent Feedback Loops* (2026) — source of the Hyderabad case cited in B.1
- *AI-enabled decision support systems for patient triage: a scoping review* — source of the RAG-grounding recommendation in B.2
