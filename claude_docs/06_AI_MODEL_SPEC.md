# Document 5 — AI Training & Model Specification
**Status key:** 🟢 EXISTING · 🟡 EXTEND · 🔴 NEW

---

## 1. Model Selection Rationale

**Full architecture: `15_AI_STRATEGY_UNIFIED.md`.** Every AI-touching capability below is now framed as either the Knowledge Engine (retrieval only, no reasoning), the Reasoning Engine (grounded reasoning, two backends), or fully deterministic (no model at all).

| Capability | Engine | Model/API | Why (cost/speed/accuracy tradeoff) |
|---|---|---|---|
| Symptom triage (text) — red-flag detection | Deterministic (not AI) | Rule engine, 41-keyword scanner | Zero-cost, zero-latency, true-zero-hallucination safety net that runs before anything else |
| Symptom triage (text/image) — non-emergency refinement | Reasoning Engine, online backend | Gemini 1.5 Flash → Groq Llama-3.2-90B-Vision → NVIDIA NIM Llama-3.1-70B, grounded in Knowledge Engine retrieval | All three have usable free tiers via LiteLLM; reasons only over retrieved WHO IMCI/ETAT chunks (`14_RAG_SYSTEM_DESIGN.md`), not parametric memory; automatic fallback so no single provider's rate limit stalls the product |
| Symptom triage — offline refinement | Reasoning Engine, offline backend | LoRA-tuned MedGemma 1.5 4B (or lighter comparable edge model), on-device, via ONNX Runtime Mobile | The only component actually fine-tuned (`13_FINE_TUNING_TRAINING_PLAN.md`) — free GPU compute (Colab/Kaggle) is sufficient at LoRA scale; MedGemma starts medically pretrained, unlike a generic base model |
| Clinical guideline retrieval | Knowledge Engine | pgvector on Neon Postgres + multilingual embedding model | Zero new infrastructure — reuses your existing free Postgres; retrieval only, no generation, so this component cannot itself hallucinate (`14_RAG_SYSTEM_DESIGN.md`) |
| Price estimation | Deterministic (not AI) | Curated static DB lookup | 100%-correct-by-construction for every entry it covers — not a Reasoning Engine task, see `15_AI_STRATEGY_UNIFIED.md` §4 |
| Price estimation, unverified fallback | Bounded-risk extraction (not the Reasoning Engine) | DuckDuckGo scrape + double-lock-grounded LLM extraction (opt-in, off by default) | Extraction only — the model points at a number and its extraction is mechanically verified, never generates one (`12_AI_RELIABILITY_HARDENING_PLAN.md` §A.3). Recommended cut from the SIH demo build entirely. |
| Scheme eligibility | Deterministic (not AI) | Rule engine, 8 schemes | No ambiguity to reason about — a rule evaluation, not a Reasoning Engine task |


## 1.5 Model Inventory (free-tier limits — verify against current provider docs before build, these change without notice)

| Provider | Model ID | Free-tier limit (as of last check) | Typical latency | Use for |
|---|---|---|---|---|
| Google AI Studio | `gemini-1.5-flash` | Free tier: request-per-minute and daily caps apply, no card required | ~1–2s | Vision cascade stage 1 |
| Groq | `llama-3.2-90b-vision-preview` | Free tier: generous requests/min, token/day caps | Sub-second to ~2s (Groq's inference hardware is fast) | Vision cascade stage 2 |
| NVIDIA NIM | `llama-3.1-70b-instruct` | Free NIM credits/tier | ~2–4s | Vision cascade stage 3 (final fallback) |
| DuckDuckGo (via `duckduckgo-search`) | N/A (search, not a model) | Free, unofficial — no SLA, no key required | Variable, 1–5s | Cost-estimate scrape fallback only, gated off by default |

**Action item for your team:** free-tier limits from every provider above change frequently and without much notice — pin exact current numbers from each provider's own pricing page during Sprint 0 (`08_ROADMAP_EXECUTION_PLAN.md`) rather than trusting any number written here as still accurate on build day.

## 2. Training Data Sources

All sources below are freely downloadable without institutional approval, login, or credentialing — see `07_DATA_CATALOG.md` for full detail. Summary here:

| Source | Used for |
|---|---|
| Kaggle Symptom-Disease Prediction Dataset | Base symptom→urgency labeling, relabeled to WHO IMCI-aligned tiers |
| WHO IMCI Guidelines (public PDF) | Ground-truth clinical checklist logic for the deterministic engine |
| AI4Bharat (IIT Madras): IndicBERT, IndicTrans2, IndicVoices, Vaani | Multilingual voice/text understanding for the 9-language i18n layer |
| SNOMED CT India Drug Extension | Standardized clinical terminology mapping (not for dosage — for triage-category labeling only, per the hard restriction on prescribing) |
| PM-JAY Health Benefit Packages (public PDF/portal) | Curated disease cost DB seed data |
| NLEM 2022 (nppa.gov.in) | 384 price-capped essential medicines, used for the PMBJP-routing cost-comparison logic |

## 3. Data Preprocessing Pipeline

1. **Ingest** raw Kaggle symptom-disease CSV → validate schema (drop rows with missing symptom or label fields).
2. **Relabel** raw disease labels into 4-tier urgency buckets (L1 Routine / L2 Consult Soon / L3 Urgent / L4 Emergency) using WHO IMCI severity mapping as the labeling rubric — this relabeling is done manually/rule-based by the team, not by an LLM, so the ground truth used for evaluation isn't itself AI-generated.
3. **Multilingual expansion:** for each symptom phrase, generate Hindi/Bengali equivalents via AI4Bharat IndicTrans2, then **human-review every generated phrase** before it enters the safety-gate keyword list — an unreviewed machine translation must never ship into the deterministic safety layer, since a mistranslation there is a patient-safety bug, not a UX bug.
4. **Deduplicate & normalize** (lowercase, strip diacritics for matching purposes only — display strings keep correct script/diacritics).
5. **Split** into train/validation/test (70/15/15) for any component that involves the LLM-cascade's secondary refinement tier — the deterministic keyword list itself has no train/test split, since it's not a trained model.

## 4. Model Architecture per Capability

### 4.1 Triage 🟢
- **Input:** `{text: string, lang: enum, image?: base64}`
- **Output:** `{tier: L1|L2|L3|L4, confidence: float, source: "deterministic"|"gemini"|"groq"|"nvidia"|"uncertain", vision_downgrade_blocked: bool}`
- **Confidence scoring:** deterministic matches always report `confidence: 1.0`; LLM-cascade matches report the provider's own returned confidence, normalized to 0–1; `uncertain` reports `confidence: 0`.
- **Fallback cascade:** see `03_SYSTEM_ARCHITECTURE.md` §5 and `04_AI_SAFETY_ETHICS.md` §3 for the exact ruleset — not repeated here to avoid two documents drifting out of sync; this document is the model-behavior spec, that one is the safety-rule spec.

### 4.2 Cost Estimation 🟢
- **Input:** `{disease_id, hospital_tier, funding_route, demographics?}`
- **Output:** `{estimated_cost, confidence, tag: "verified_official_data"|"community_estimate_unverified"|"no_estimate_available", breakdown: [{item, cost}]}`
- **Fallback cascade:** curated DB → web-scrape+LLM-extraction (opt-in) → no estimate.

### 4.3 Scheme Matching 🟢
- **Input:** `{income, category, state, family_size}`
- **Output:** `{eligible_schemes: [{scheme_id, coverage_amount}]}`
- **Confidence:** N/A — this is a deterministic rule evaluation, not a probabilistic model; there is no confidence score because there is no uncertainty in the logic path.

### 4.4 Vision Analysis 🟢
- **Input:** image (rash/wound/lab report photo)
- **Output:** `{finding_category, severity_signal: "emergency"|"non_serious", confidence}` — **never** a named diagnosis, per the hard restriction in `04_AI_SAFETY_ETHICS.md`.
- **Confidence scoring:** provider-native confidence, normalized; `uncertain` (confidence 0) if all 3 stages fail.

## 5. Evaluation Metrics & Pass Bars

| Metric | Component | Minimum threshold |
|---|---|---|
| Emergency recall (sensitivity for true L4 cases) | Deterministic safety gate | **≥ 0.95** — this is the single most important number in the whole evaluation suite |
| False positive rate on non-emergency text | Deterministic safety gate | Reported but **not capped** — the design principle explicitly accepts over-triggering (fail toward caution) over under-triggering |
| Overall triage tier accuracy | Full pipeline (gate + LLM cascade) vs. WHO IMCI-labeled test set | ≥ 0.75 |
| Vision cascade uptime-equivalent (successful response from *any* of the 3 providers) | AI cascade | ≥ 0.90 in normal conditions; graceful `uncertain` on the remaining 0.10 |
| Cost estimate accuracy (curated DB path) vs. PM-JAY published HBP rates | Cost Analyzer | 100% for in-database procedures (it's a lookup, not a prediction) |

**Test set composition:** held-out 15% split from the relabeled Kaggle set, supplemented with a hand-written adversarial set of 100+ red-flag phrasings across all 3 languages (see `09_QA_TEST_PLAN.md` §4 for the exact test-case categories) — the adversarial set is what actually validates the ≥0.95 emergency recall bar, since the Kaggle-derived split alone under-represents true emergencies.

**Cross-validation strategy:** 5-fold CV on the LLM-cascade refinement tier's evaluation set only; the deterministic gate is validated by exhaustive enumeration against its keyword list, not sampling, since it's a fixed ruleset rather than a learned model.

## 6. Prompt Engineering Templates 🟢

### 6.1 Vision Triage — System Prompt 🟡 EXTENDED (Knowledge Engine grounding added)
```
You are a clinical decision-support assistant operating under strict safety rules.
You are analyzing a photograph submitted by a rural patient or community health
worker in India. You must NEVER provide a named medical diagnosis. You must NEVER
suggest medication names or dosages. Your only job is to classify the visible
finding into one of two severity signals: "emergency" or "non_serious", and to
briefly describe the visible finding category (e.g. "skin lesion", "visible wound",
"lab report values") in plain language.

You will be given RETRIEVED_GUIDELINE_CONTEXT below, drawn from WHO IMCI/ETAT
guidelines. You MUST base your severity_signal and reasoning ONLY on this
retrieved context and the image/text in front of you — NOT on general medical
knowledge from your training. If the retrieved context does not clearly cover
this case, say so honestly in your reasoning rather than reasoning from memory.

Return ONLY valid JSON in this exact shape:
{"finding_category": string, "severity_signal": "emergency"|"non_serious",
 "confidence": float between 0 and 1, "reasoning": short plain-language string,
 "grounding_reference": chunk_id string from RETRIEVED_GUIDELINE_CONTEXT, or null
 if no retrieved chunk adequately supports this classification}

If the image is unclear, low quality, or you cannot confidently assess it, set
severity_signal to "non_serious" and confidence to a LOW value (below 0.4) rather
than guessing — a downstream deterministic safety layer will independently catch
any emergency indicated by the patient's described symptoms, so you do not need
to compensate for uncertainty by escalating; you need to compensate for
uncertainty by reporting it honestly.
```

### 6.2 Vision Triage — User Prompt Template 🟡 EXTENDED (retrieved context added)
```
RETRIEVED_GUIDELINE_CONTEXT (from Knowledge Engine, `14_RAG_SYSTEM_DESIGN.md`):
{retrieved_chunks_with_ids}

Patient-submitted image. Patient's own text description (if provided): "{symptom_text}"
Language of the original description: {lang}
Analyze the attached image per your system instructions, grounded only in the
retrieved context above.
```

### 6.3 Output Parsing Logic
```python
# Pseudocode — exact implementation lives in the vision cascade module
def parse_vision_response(raw_json: str) -> VisionResult:
    try:
        data = json.loads(raw_json)
        assert data["severity_signal"] in ("emergency", "non_serious")
        assert 0.0 <= data["confidence"] <= 1.0
        return VisionResult(**data)
    except (json.JSONDecodeError, KeyError, AssertionError):
        # Malformed LLM output is treated as a cascade-stage failure,
        # NOT as a "non_serious" reading — this prevents a parsing bug
        # from silently downgrading a case.
        raise CascadeStageFailure()
```

### 6.4 Cost Extraction (web-scrape fallback path) — System Prompt
```
You are extracting a treatment cost estimate from search result text for
{disease_name} in India. Only extract a number if it is explicitly stated as a
cost, price, or fee in the source text. If no explicit cost figure is present,
return null — do not estimate, infer, or calculate a plausible-sounding number.
Return ONLY valid JSON: {"cost_min": number|null, "cost_max": number|null,
"source_snippet": short string ≤ 200 chars, "currency": "INR"}
```
