# Document 13 — Fine-Tuning & Training Plan for the Financial and Accessibility Spots

**Architecture note:** in `15_AI_STRATEGY_UNIFIED.md` terms, the model this document fine-tunes is the **Reasoning Engine's offline backend** — the only backend that can actually be fine-tuned for free. The hosted cascade (Gemini/Groq/NVIDIA) is the Reasoning Engine's *online* backend, and achieves equivalent behavior through few-shot structured prompting instead, using this same document's training-pair data as in-context exemplars rather than gradient updates. Both backends share one output contract — see doc 15 §3.

## 0. Read this section before any of the rest — it changes what the plan actually contains

**The Financial Spot gets no fine-tuning plan, and that's the correct answer, not a gap.** It's currently 100%-correct-by-construction on everything it covers, because it's deterministic code with no model in the decision path. Fine-tuning would mean replacing a component that's *provably* correct with one that's merely *usually* correct — a strict downgrade in exactly the property you're asking for. §1 explains what actually moves the needle there instead.

**"1–2% hallucination, 99% correct" is a specific, checkable statistical claim, and this project cannot honestly claim to have validated it within a 6-week hackathon.** Not because the target is wrong to aim at — it's the right direction — but because *proving* a 1% error rate requires a labeled, clinician-verified test set of a size this team won't have access to for free in this timeframe. §5 shows the actual math, because "trust me, it's accurate" without that math is exactly the kind of claim a judge (or a real user) shouldn't accept from anyone, including you.

What follows is the plan for what's genuinely achievable: a real, technically grounded fine-tuning effort for the one component where fine-tuning is the right tool — the on-device edge model in your existing roadmap — plus an honest, statistically defensible path toward the reliability target over time.

---

## 1. The Financial Spot: what actually improves reliability (not fine-tuning)

Nothing here changes from `12_AI_RELIABILITY_HARDENING_PLAN.md` Part A — re-stated briefly because it's the direct answer to "how do we get this to 99%+ correct":

- The curated dataset lookup and scheme-eligibility logic are already at 100% correctness *for every case they cover*, because they're not predictions, they're lookups and rule evaluations. The lever for reliability here is **coverage and data accuracy**, not model quality: more verified disease/procedure entries, more rigorously tested eligibility rules (property-based/fuzz testing per doc 12 §A.4), a documented provenance trail per entry.
- The only place a trained model would even be relevant is the (recommended-for-removal) scrape-fallback path — and there, the fix is grounding/verification of an *extraction* task, not fine-tuning a model to *generate* better numbers. Training a model to produce financial figures more fluently makes it a more convincing liar when it's wrong, not a more accurate one.

## 2. The Accessibility Spot: where fine-tuning is legitimate, and where it isn't

Your architecture has two AI-touching layers, and they need opposite treatment:

| Layer | Can you fine-tune it? | What to actually do |
|---|---|---|
| The hosted cascade (Gemini 1.5 Flash, Groq Llama-3.2-90B-Vision, NVIDIA NIM Llama-3.1-70B) | **No, not within your free-tier budget.** These are inference-only free APIs; none of the three offers a free fine-tuning path at this model scale, and attempting one would break your ₹0 constraint. | Continue using the prompting, grounding, structured-output, and calibration techniques from `12_AI_RELIABILITY_HARDENING_PLAN.md` Part B — that document already is the reliability plan for this layer. |
| The on-device edge model (already in your roadmap, Phase 4, originally scoped as generic Gemma 3n 4B via ONNX) | **Yes — this is a model you'd actually own and control**, and free GPU compute (Google Colab / Kaggle free tiers) is enough for LoRA-scale fine-tuning at this size. | This is where the rest of this document applies. |

### 2.1 Recommendation: change the base model for Phase 4

Don't start LoRA fine-tuning from a generic Gemma 3n 4B. Google publishes **MedGemma** — an open-weight, Gemma-3-based model family specifically pretrained on medical data and explicitly designed to be fine-tuned for exactly this kind of downstream clinical task, released under a free research/commercial license (Health AI Developer Foundations terms). The 4B variant is specifically positioned for compute-efficient, offline-capable, edge deployment — which is precisely your Phase 4 use case. Starting from a medically-pretrained base instead of a general-purpose one means your LoRA adapter has to teach the model far less from scratch.

**A lighter alternative worth evaluating alongside it:** smaller community-fine-tuned medical models built for smartphone-class edge deployment (in the 1.7–2B parameter range) have recently shown competitive or better real-world clinical-task performance than the 4B medical baseline, at a smaller footprint — worth a head-to-head comparison against MedGemma 4B on your own evaluation set (§5) before committing, since footprint directly trades against your <100MB/2GB-RAM constraints.

**The one non-negotiable caveat, stated explicitly by MedGemma's own documentation and worth repeating in your own ethics doc:** this class of model is *not* clinical-grade out of the box, and must never be the sole basis for a clinical decision. That's not a limitation specific to your team's execution — it's the model publisher's own stated position. It reinforces, rather than weakens, your existing architecture: the deterministic safety gate stays the final authority no matter what this fine-tuned model outputs.

### 2.2 Fine-tuning technique

- **Method: LoRA (or rsLoRA, a documented improvement on standard LoRA).** At this model scale, LoRA reduces trainable parameters to under 1% of the full model, which is what makes this feasible on free-tier compute (a free Colab/Kaggle GPU instance) instead of requiring dedicated hardware.
- **Practical starting hyperparameters** reported in comparable clinical LoRA fine-tuning work: rank and alpha around 16, a handful of epochs (not dozens — small, well-curated datasets overfit fast at higher epoch counts), small batch size, learning rate around 2e-4. Treat these as a starting point to tune against your own validation set, not as fixed values.
- **Tooling:** libraries built for exactly this workflow (e.g., Unsloth combined with Hugging Face's TRL) report meaningfully faster fine-tuning at this scale, which matters when your compute budget is a free GPU quota with a weekly cap, not a dedicated cluster.
- **Calibration-aware training, not just accuracy-aware training.** This is the most important technical nuance for a hallucination-sensitive use case: research on LoRA fine-tuning specifically found that a single fine-tuned LoRA adapter tends to become *more accurate but more overconfident on its wrong predictions* than the un-tuned baseline — exactly the failure mode you can't afford. A small **LoRA ensemble** (a few independently-trained adapters on the same base model, with predictions aggregated) has been shown to improve both accuracy and calibration together, not just accuracy alone. Given your free-compute budget, 2–3 small LoRA adapters trained with different data shuffles/seeds and combined via majority vote (with the same "disagreement escalates caution" rule from doc 12 §B.4) is a realistic target, not an exotic one.
- **Stretch goal, not core plan: preference-based factuality tuning (DPO-style).** Beyond standard supervised fine-tuning, current work on hallucination reduction uses preference optimization — training the model on paired examples of a grounded-correct response versus a plausible-but-wrong one, explicitly teaching it to prefer the grounded answer. This is a legitimate, more advanced lever, but it requires constructing contrastive training pairs specifically, which is real additional data-engineering work — treat it as a post-hackathon research direction unless your timeline has clear slack for it, not as something to promise for the demo.

## 3. Data sources for the fine-tuning/grounding layer

| Source | What it's actually good for | What it's NOT good for |
|---|---|---|
| WHO IMCI / ETAT guideline text, converted into instruction-tuning pairs (symptom pattern → severity tier + reasoning grounded in the guideline excerpt) | The single most directly relevant dataset for this specific task — this is what should anchor most of your fine-tuning data | Doesn't exist pre-packaged as a training set; converting it into instruction-tuning format is real, manual, clinician-reviewable work — budget real time for this, don't treat it as a quick data-prep step |
| Kaggle Symptom-Disease Prediction dataset, relabeled to your 4-tier urgency scale (already planned in `06_AI_MODEL_SPEC.md` §3) | Broad symptom-to-condition coverage, free, already in your pipeline | Not severity-labeled out of the box (your team's relabeling work is what makes it usable, and that relabeling needs the same clinical review rigor as anything else safety-critical) |
| MedQA / PubMedQA (open medical QA benchmarks) | Useful as general clinical-reasoning grounding for the base model's broader medical competence | These are English-language, exam-style multiple-choice datasets — not a substitute for real triage-severity training data, and not multilingual. Use for general capability, not as your core fine-tuning signal |
| AI4Bharat multilingual NLP resources (IndicTrans2, IndicVoices) | Generating and reviewing Hindi/Bengali training-pair variants of your English instruction data | Any machine-generated multilingual training example must go through the same **mandatory human review gate** as your safety-keyword translations (`06_AI_MODEL_SPEC.md` §3) before it enters a fine-tuning set — an unreviewed mistranslation baked into training data is worse than one caught at inference time, because it's now systematically reinforced rather than a one-off error |

## 4. What NOT to do (specific to fine-tuning, in addition to `12_AI_RELIABILITY_HARDENING_PLAN.md` Part C)

- Don't fine-tune the hosted cascade providers — not possible for free at this scale, and not necessary given the prompting/grounding techniques already available to you there.
- Don't fine-tune only a single LoRA adapter and treat calibration as solved — the research is specific that this is where overconfidence gets *worse*, not better, unless you use an ensemble or an explicit calibration step afterward.
- Don't skip the clinical-guideline-grounded training pairs in favor of only the easier-to-get Kaggle-derived data — the guideline-grounded pairs are what actually teaches the model *why* a case is severe, not just a pattern-matched label.
- Don't treat a one-time fine-tuning run as a finished deliverable — see §6.

## 5. The statistics you actually need, to honestly claim a 1–2% error rate

This is the part most plans skip, and it's the part that matters most for a domain where "mistakes aren't tolerated."

To estimate a true error rate of roughly 1.5% with a reasonably tight 95% confidence interval (±1 percentage point), the standard binomial sample-size calculation requires **on the order of 550–600 labeled test cases** — and that's for one pooled measurement. Two things make the real requirement much larger than that single number suggests:

1. **A pooled average can hide a dangerous subgroup gap.** A model with a 1.5% overall error rate could still have, say, an 8% error rate specifically on Bengali negation-phrased inputs (a category doc 12 §B.7 already flags as adversarially important) while looking excellent on the aggregate number. To make a subgroup-level claim — which is the claim that actually matters for a 9-language, safety-critical product — you need close to that same ~550–600 case count *per meaningfully distinct subgroup* (per language, at minimum; ideally per language × per major symptom category), not 550 total.
2. **The test set has to be clinician-labeled, not student-labeled**, for the resulting percentage to mean what you'd be claiming it means to a judge or a real user. Student-labeled data measures agreement with your own team's assumptions, not clinical accuracy.

**Honest conclusion:** building a test set large and clinically-verified enough to *prove* a 1–2% error rate, across 9 languages, is realistically a multi-month effort requiring genuine clinical partnership (your roadmap's "Clinical Mentor Review" phase is the right first step toward this, not a stand-in for it) — not a 6-week hackathon deliverable. The right thing to present at your SIH demo is not "we've validated 99% accuracy" (which would be overclaiming exactly the way you don't want to), but: *"here is our calibration and evaluation methodology, here is what we've measured so far on our current test set of [n] cases, and here is the specific plan to reach a clinically-validated result post-hackathon."* That is a stronger, more credible answer to a judge's question than a number you can't back up if pressed.

## 6. Ongoing monitoring, because a fine-tuned model is not a finished deliverable

A LoRA adapter's accuracy on the day you trained it isn't a permanent property — real user inputs will include phrasings, code-switching patterns, and edge cases your training/test data didn't anticipate. Commit to:

- Logging every low-confidence or override-triggering case (the `safety_override_log` table from `01_AUDIT_KEEP_KILL.md` already gives you the mechanism) as future evaluation/training material.
- Re-running the full adversarial and calibration test suite (`09_QA_TEST_PLAN.md` §9) against the fine-tuned model on a fixed cadence, not just once before the demo.
- Treating any measured degradation as a trigger to re-tune or roll back to the previous adapter version, with version history kept (the same discipline as the CI-gated safety test suite for the deterministic layer).

## 7. Honest summary — what's realistic in 6 weeks vs. what's a genuine longer-term goal

| Goal | Realistic in the hackathon window? |
|---|---|
| Deterministic paths (safety gate, scheme matcher, curated cost DB) remain 100%-correct-by-construction | **Yes — this is already true, and the work is testing/coverage, not training.** |
| A working LoRA-fine-tuned edge model (MedGemma 4B or a lighter comparable base), evaluated on your current test set, with a documented calibration methodology | **Yes — this is a legitimate, achievable Phase 4 deliverable.** |
| A statistically defensible, clinician-verified 1–2% hallucination rate claim, robust across all 9 languages | **No — not within 6 weeks, and no honest team should claim otherwise.** Present the methodology and current measured numbers instead, with the multi-language clinical validation explicitly framed as the next phase. |

## Further Reading

- Hu et al., *LoRA: Low-Rank Adaptation of Large Language Models* (2021) — the foundational method
- *Reducing LLM Hallucinations in 2026: LoRA, F-DPO, and the Math That Actually Works* — source of the LoRA-ensemble calibration finding in §2.2 and the F-DPO stretch-goal reference
- Google, *MedGemma: Our most capable open models for health AI development* — model family, license terms, and fine-tuning guidance referenced in §2.1
- *Enhancing privacy-preserving deployable large language models for perioperative complication detection: a targeted strategy with LoRA fine-tuning* — comparable clinical LoRA fine-tuning study, source of the hyperparameter starting points in §2.2
- *MedSlice: Fine-Tuned Large Language Models for Secure Clinical Note Sectioning* — source of the rsLoRA hyperparameter and training-time reference points
