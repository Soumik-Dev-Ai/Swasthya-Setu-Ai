# Document 23 — Complete End-to-End Fine-Tuning & Training Guide
**Self-contained. Everything you need is in this one file — no need to cross-reference the other 22 documents to execute this.**

---

## 0. Read This First — What You're Building and Why

You're fine-tuning **one model: the offline/edge Reasoning Engine backend.** Not the online hosted cascade (Gemini/Groq/NVIDIA — can't be fine-tuned on any free tier, and don't need to be, they use few-shot prompting instead). Not the Financial Spot (that's a deterministic lookup, permanently, by design — fine-tuning it would make it *less* reliable, not more, since it would introduce a generative step where none currently exists).

**What you'll end up with:** a LoRA-fine-tuned, quantized, ONNX-packaged small model that runs directly on a user's phone, with its own compact on-device knowledge corpus, producing the exact same structured output as your online cascade so the rest of your system can't tell (and doesn't need to know) which backend answered a given request.

**Whose time this costs:** mostly yours for the *first* training run, regardless of platform — see Section 4 for exactly where the line falls. If you use Kaggle specifically (not Colab) and your agent has verified API access, later re-runs can move to your agent via Kaggle's CLI-driven kernel execution; Colab's free tier stays interactive-only either way. Budget a real afternoon for the first pass specifically — it's meant to be watched, not fire-and-forget.

**Sequencing note:** this is easiest if your RAG corpus (WHO IMCI/ETAT/IMAI documents) already exists from earlier project work, since data prep reuses it. This document gives full acquisition steps regardless, so it works whether or not that's already done.

---

## 1. Choose Your Base Model — decide this before downloading anything

Two real options, both open-weight, both free:

| Option | Size | Tradeoff |
|---|---|---|
| **MedGemma 1.5 4B** (recommended default) | ~4B params, ~2GB at INT4 quantization | Medically pretrained by Google specifically for this kind of task — your LoRA adapter has less to teach it from scratch. Larger footprint. |
| **Lighter ~1.7B-class edge medical model** (e.g., MedPsy-1.7B or comparable) | ~1.7B params, under 1GB at INT4 | Smaller footprint leaves real headroom for the on-device retrieval index it has to share phone memory with. Some benchmarks show it competitive with or beating the 4B model despite being smaller. |

**The real constraint driving this choice:** a 2GB INT4 model alone is already tight against a 2GB RAM device target *before* adding the on-device RAG retrieval index on top of it — that's a genuine memory conflict, not a hypothetical one. **Before committing fully to one option, test both base models' memory footprint plus a representative retrieval index size on an actual low-end Android device (or an emulator with RAM throttling set to 2GB).** If MedGemma 4B doesn't leave workable headroom, default to the lighter option rather than discovering this after a full fine-tuning run.

**For this document, "the base model" refers to whichever you pick — the process is identical either way, only the exact Hugging Face model ID changes.**

**Two different constraints, don't conflate them:** this section's 2GB *deployment* target is about the phone the finished model eventually runs on. Section 4 covers a separate number — the VRAM on whatever machine you use to *train* it, which only matters during the fine-tuning process itself and has nothing to do with the deployment target once training is done.

---

## 2. Acquire the Training Data

### 2.1 Kaggle Symptom-Disease Dataset
1. Create a free account at kaggle.com.
2. Go to Account Settings → API → "Create New Token" — this downloads `kaggle.json`.
3. `pip install kaggle`, then place `kaggle.json` per Kaggle's setup instructions (typically `~/.kaggle/kaggle.json` on Linux/Mac).
4. Run: `kaggle datasets download -d itachi9604/disease-symptom-description-dataset`
   (confirm this slug still resolves on the dataset's Kaggle page — slugs occasionally change owners)
5. Unzip into `training_data/raw/kaggle_symptom_disease/`

### 2.2 WHO Clinical Guideline Text (verified direct URLs)
```bash
mkdir -p training_data/raw/who_guidelines
cd training_data/raw/who_guidelines

curl -L -o who_imai_vol1.pdf \
  "http://apps.who.int/iris/bitstream/10665/77751/1/9789241548281_Vol1_eng.pdf"

# WHO IMCI and ETAT: search "WHO IMCI chart booklet" and "WHO ETAT manual"
# on who.int/publications if you don't already have these from earlier RAG
# corpus work — same governance rule as always: official WHO publication
# pages only, no mirrors.
```
If your RAG corpus (`docs_raw/`) from earlier project work already has these, just point to that folder instead of re-downloading — same files, same purpose here (instruction-pair source material instead of retrieval chunks).

### 2.3 AI4Bharat Multilingual Resources (for Hindi/Bengali augmentation)
1. Create a free account at huggingface.co.
2. `pip install huggingface_hub`, then `huggingface-cli login` with a token from your HF account settings.
3. `huggingface-cli download ai4bharat/indictrans2-en-indic-1B` (or the specific model/dataset you need — search "ai4bharat" on huggingface.co to confirm current model names, they update periodically).

**Folder structure at the end of this step:**
```
training_data/
├── raw/
│   ├── kaggle_symptom_disease/dataset.csv
│   ├── who_guidelines/*.pdf
│   └── ai4bharat/  (gitignore this — see below)
└── processed/       (populated in step 3)
```
**Add `training_data/raw/ai4bharat/` to `.gitignore`** — model weights here run hundreds of MB to several GB and shouldn't live in git history. The Kaggle CSV and WHO PDFs are small enough to commit safely.

---

## 3. Prepare the Data — CLAUDE CODE PROMPT #1

Paste this to Claude Code once the raw files from step 2 exist locally:

```
Build the training data preparation pipeline for fine-tuning the edge Reasoning
Engine model. Input: training_data/raw/. Output: training_data/processed/.

1. Relabel the Kaggle symptom-disease CSV from its raw disease labels into our
   4-tier urgency scale (L1 Routine / L2 Consult Soon / L3 Urgent / L4
   Emergency), using WHO IMCI/ETAT severity criteria as the labeling rubric.
   This relabeling must be rule-based/manual logic you write, not another LLM
   call generating ground truth — the labels this produces become training
   data, so they need to be as close to authoritative as this project can get
   without a clinician physically reviewing every row.

2. Convert the WHO IMCI/ETAT/IMAI guideline PDFs into instruction-tuning pairs:
   for each severity/symptom criterion in the source text, generate a
   {symptom_description, correct_severity_tier, reasoning_grounded_in_guideline_excerpt}
   triple. The reasoning field must quote or closely paraphrase the actual
   guideline text it's grounded in — this is training the model's *reasoning
   style*, not injecting facts it should memorize instead of retrieve, so
   keep each pair traceable to its source excerpt.

3. Flag every instruction pair generated in step 2 for human review before
   it's considered final — output them to
   training_data/processed/needs_clinical_review.jsonl rather than directly
   to the training-ready file. Do not mark this step "complete" until a human
   (ideally your Clinical Mentor Review phase) has actually reviewed these,
   the same review-gate discipline already established for translated
   safety-keyword content elsewhere in this project.

4. If generating Hindi/Bengali augmented variants via AI4Bharat translation
   models: same rule — every machine-translated pair goes to the same
   needs_clinical_review.jsonl queue, never directly to the training set.

5. Output final format: JSONL, one instruction-tuning example per line, schema:
   {"input": symptom_description, "output": {"severity_tier": str,
   "confidence": float, "reasoning": str, "grounding_reference": str}}
   — this must match the exact output contract already used by the online
   cascade's structured output (06_AI_MODEL_SPEC.md if available in this repo,
   otherwise: severity_tier in ["L1","L2","L3","L4"], confidence 0-1,
   grounding_reference pointing to a specific source passage).

Report: how many pairs generated, how many flagged for review, and the
train/validation/test split (70/15/15) applied to the reviewed set only.
```

**You do this part yourself, not Claude Code:** actually reviewing the `needs_clinical_review.jsonl` queue. This is real, unavoidable manual work — nobody can automate a clinician's judgment call, and skipping this step means training on unverified labels for a safety-relevant task.

---

## 4. Set Up Your Training Environment — three real options, choose based on your hardware

**Option C: Local training, if you have a CUDA-capable GPU** — this is often the *better* choice if your hardware supports it, not just a fallback. It resolves the Kaggle-vs-Colab autonomy question entirely: training runs as a local process, so your agent can launch it, monitor logs, and report progress, while you can also watch the same terminal directly — no cloud account, no quota, no browser dependency either way.

**VRAM budget, QLoRA (4-bit quantization — this is the fine-tuning approach throughout this document, not full fine-tuning, which needs far more VRAM than any consumer card provides):**

| Model | Base weights (4-bit) | Realistic total with training overhead | Comfortable on... |
|---|---|---|---|
| MedGemma 1.5 4B | ~2.0–2.5GB | ~4–5.5GB (batch size 1-2, gradient checkpointing on, ~512 token sequences) | 8GB+ VRAM; tight but workable on 6GB with careful tuning |
| Lighter ~1.7B alternative | ~0.85–1GB | Comfortably under 4GB even with larger batch size, longer sequences | 6GB VRAM or less, easily |

If your GPU has 6GB VRAM: start with the lighter model — faster iteration, minimal OOM risk, validates your whole pipeline cheaply before you decide whether MedGemma 4B's tighter fit is worth attempting. 16GB system RAM is generally sufficient for data loading/tokenization at this scale regardless of which model you choose — VRAM is your actual constraint, not system RAM.

**Local setup requirements:** a CUDA-compatible NVIDIA driver and CUDA toolkit matching your PyTorch build; `pip install unsloth bitsandbytes` (Unsloth explicitly supports local consumer GPUs, this isn't a cloud-only tool); on Windows, WSL2 is recommended for the smoothest compatibility with bitsandbytes.

**CLAUDE CODE PROMPT — local environment setup:**
```
Set up a local QLoRA fine-tuning environment for [MedGemma 1.5 4B / the
lighter ~1.7B alternative — specify model ID] on my machine (6GB VRAM, 16GB
system RAM, CUDA-capable GPU).

1. Check my current CUDA driver version and confirm PyTorch/bitsandbytes/
   Unsloth compatibility before installing anything. If any step needs
   admin/sudo permissions you don't have, stop and tell me exactly which
   step and why, rather than silently failing partway through.
2. Install: unsloth, bitsandbytes, and any other dependencies the training
   script from the next step will need.
3. Configure the training script (from the next prompt) to use 4-bit NF4
   quantization, gradient checkpointing enabled, batch size 1-2 with gradient
   accumulation to reach an effective batch size comparable to what a larger
   GPU would use directly, and a conservative max sequence length to start.
4. Run a tiny smoke test first — a handful of training steps on a small data
   subset — and report actual peak VRAM usage before I commit to a full
   training run. If it's close to the 6GB ceiling, reduce batch size/sequence
   length further and re-test rather than risk an OOM crash mid-run on the
   real dataset.
```

**CLAUDE CODE PROMPT — run training supervised, in the foreground, with live monitoring (recommended for your first run, given how close 6GB is to the estimated ceiling):**
```
Run the fine-tuning job in the foreground, not backgrounded — I'm staying
present to watch it directly and want to catch any problem (training error
or hardware issue) the moment it happens, not discover it later.

1. Run training directly in this terminal session so output streams live —
   don't detach it to a background process for this run.
2. In parallel, set up a second terminal (or split output) running
   `nvidia-smi -l 1` (or equivalent) so I can watch VRAM usage update every
   second — this is my tightest constraint and I want to see it in real time,
   not just find out after an OOM crash.
3. Still enable checkpointing every N steps (same as before) — even though
   I'm watching, I don't want to lose progress if I need to stop and resume,
   or if something unexpected happens.
4. Print the loss value clearly after every step or every few steps — flag
   immediately, visibly, if loss becomes NaN or inf, or if it stops
   decreasing in a way that looks wrong, rather than letting it run on
   quietly with a broken training signal.
5. If VRAM usage gets within ~200-300MB of the 6GB ceiling at any point,
   flag it loudly before it becomes an actual OOM crash, so I can decide
   whether to stop and reduce batch size/sequence length rather than let it
   fail on its own.
```

**What to actually watch for while it runs:**
- **Loss curve:** should trend downward, not flat or erratic. A sudden jump to NaN/inf means stop immediately — that's a numerical instability, not something that self-corrects.
- **VRAM usage (via `nvidia-smi`):** should stay stable once training reaches steady-state after the first few steps. A pattern of it climbing steadily rather than plateauing usually means a memory leak (e.g., gradients or activations not being freed properly) that will eventually OOM even if it hasn't yet.
- **GPU temperature**, if `nvidia-smi` is showing it: sustained high temps (consult your specific GPU's safe operating range) are worth pausing for if you're concerned about your cooling setup — this is a personal-hardware call, not a training-correctness one.
- **General system responsiveness:** if your whole machine becomes sluggish or unresponsive beyond what you'd expect from GPU load, that's worth investigating before continuing, not pushing through.

**Once you've completed one or two successful supervised runs and trust the setup:** later re-runs (e.g., after data prep changes) are a much better candidate for the background-and-monitor pattern below — full supervision matters most when the pipeline itself is still unproven, not for every run indefinitely.

**CLAUDE CODE PROMPT — run the full training as a genuinely autonomous background process (only after you've validated the setup with at least one successful supervised run):**
```
Run the full fine-tuning job as a background process, not a blocking
foreground command — I want to be able to check on this periodically rather
than have one tool call sit blocked for hours.

1. Launch training detached (e.g., nohup + & on Linux/WSL, or an equivalent
   background-process pattern), redirecting stdout/stderr to a log file
   (e.g., training_run.log) rather than the terminal.
2. Configure checkpointing to save every N steps (choose N so a checkpoint
   happens at least every 20-30 minutes of wall-clock time), not just at the
   end — if this run gets interrupted, I want to resume from the last
   checkpoint, not restart from scratch.
3. Write a small status-check script I can (or you can) run anytime to
   report: current step, latest loss value, elapsed time, and whether the
   process is still running or has exited (successfully or with an error).
4. After launching, do an immediate check-in after a few minutes to confirm
   the process is actually running and loss is moving in a sane direction —
   don't just launch it and assume it's fine.
5. Before I let this run fully unattended for hours: confirm my system's
   sleep/hibernate settings won't interrupt it, and tell me explicitly if you
   can't verify or change that setting yourself, since that's the one thing
   most likely to silently kill an otherwise-working run.
```

**Option A: Kaggle Notebooks (CLI-drivable)** — if you'd rather not manage local CUDA/driver setup, or want to compare against a 16GB-VRAM T4 for the MedGemma 4B path specifically without the local squeeze.

**If your coding agent has verified network access to kaggle.com's API** (test with `kaggle kernels list` before relying on this) **and your Kaggle API token already exists**, the training run can largely run through your agent via Kaggle's kernel API — `kaggle kernels push` to submit, `kaggle kernels status` to poll, `kaggle kernels output` to retrieve results, no browser session required.

**Option B: Google Colab — does not offer an equivalent free-tier CLI path.** Colab's free GPU access is architecturally tied to an interactive browser session, and automated/headless use of the free tier runs against the spirit of what it's for — accounts doing this have been known to get throttled. Only use this if you're running the first pass manually anyway and prefer Colab's interface over Kaggle's.

**Recommendation regardless of which option you pick:** watch the first fine-tuning pass closely — loss curve, early outputs — even where automation is possible. A submit-and-poll or fire-and-forget loop has a much slower debug cycle than watching training happen live, and for a safety-relevant model, catching a subtly wrong hyperparameter or data issue early is worth more than automating attempt one. Local training makes this easy regardless of who technically started the process, since the logs are right there either way.

**If using Colab, or setting up Kaggle manually:**
1. Go to **colab.research.google.com** (or **kaggle.com/code** for Kaggle Notebooks — Kaggle currently offers roughly 30 GPU-hours/week free; Colab's free tier gives a time-limited T4 GPU per session — check current limits on each platform before relying on either number, they change without much notice).
2. Create a new notebook.
3. Runtime → Change runtime type → select a GPU.
4. Upload your `training_data/processed/` folder (via direct upload, Google Drive mount, or Kaggle's dataset attachment feature — whichever is easiest for your file sizes).

---

## 5. Get the Training Script — CLAUDE CODE PROMPT #2

```
Write a LoRA fine-tuning script for [MedGemma 1.5 4B / your chosen lighter
alternative — specify the exact Hugging Face model ID from Section 1] using
Unsloth + TRL, as a single Jupyter notebook I can paste directly into Colab
or Kaggle cells.

Training data: training_data/processed/train.jsonl (from the pipeline you
just built), formatted to the {input, output} schema already established.

Hyperparameters, as a starting point to tune against the validation set —
these are not fixed, note in a comment that they should be adjusted based on
validation loss, not used blindly:
- LoRA rank: 16, alpha: 16
- A small number of epochs (start at 3, watch for overfitting on this
  small a dataset — more epochs is not automatically better here)
- Small batch size appropriate for a single free-tier GPU's memory
- Learning rate: 2e-4 as a starting point

Also write a SECOND, near-identical notebook cell block for training a second
LoRA adapter with a different random seed/data shuffle — I'm training a small
LoRA ensemble (2-3 adapters), not just one, because a single fine-tuned LoRA
adapter has been shown to become more accurate but MORE overconfident on its
wrong predictions than the base model — an ensemble with majority-vote
aggregation improves both accuracy and calibration together, which matters
for a safety-relevant task where confidence needs to mean what it claims.

At the end of training, save each adapter's weights to a clearly labeled
output directory (lora_adapter_1/, lora_adapter_2/, etc.) that I can download
from the notebook environment.

Include a final cell that runs the trained model against
training_data/processed/validation.jsonl and prints basic accuracy/loss so I
have an immediate sanity check before downloading anything.
```

**Run the first pass yourself, interactively** — watch it train, handle any errors as they happen, and when it finishes, **download the resulting `lora_adapter_*/` folders to your own machine.** For subsequent re-runs, once you trust the pipeline, this step can move to the Kaggle-CLI-driven path from Section 4 if your agent has verified API access — add a cell or wrapper script that saves outputs in a location `kaggle kernels output` can retrieve, so your agent can pull results automatically on later iterations.

---

## 6. Evaluate Honestly — the statistics that matter here

Before treating this model as done, know what you can and can't actually claim:

- **To validate roughly a 1–2% error rate with a reasonably tight confidence interval, you need on the order of 550–600 labeled test cases** — and that's for one pooled measurement, not per-language. A model can look excellent on an aggregate number while quietly failing on one specific language's phrasing patterns, so a genuinely defensible claim needs close to that same count **per language**, not total.
- **The test set needs to be clinician-labeled**, not just reviewed by your team, for the resulting percentage to mean what a judge or real user would assume it means.
- **Honest conclusion:** proving a specific low error rate across all 9 languages is a multi-month effort requiring real clinical partnership — not something this fine-tuning pass alone produces. What you can honestly claim after this process is a documented methodology plus whatever you've actually measured on your current test set size, explicitly framed as a starting point, not a final validated number.

### CLAUDE CODE PROMPT #3 — build the calibration harness

```
Build the confidence calibration evaluation harness for the fine-tuned edge
model (both individual LoRA adapters and the ensemble's majority-vote output).

1. Run the model(s) against training_data/processed/test.jsonl (the held-out
   15% split).
2. Bucket predictions into confidence deciles (0.0-0.1, 0.1-0.2, ... 0.9-1.0).
3. For each bucket, compute actual accuracy (predicted tier matches true
   label) vs. the bucket's average reported confidence.
4. Flag any bucket where reported confidence overstates actual accuracy by
   more than ~15 percentage points — this is the threshold for deciding the
   model needs recalibration (temperature scaling) or a clipped confidence
   ceiling before production use.
5. Separately report accuracy broken out by language if the test set includes
   multilingual examples — do not only report a single pooled number.
6. Output a plain-language summary: sample size used, per-decile calibration
   table, per-language breakdown if applicable, and an explicit statement of
   what confidence interval this sample size actually supports (use the
   standard binomial proportion CI formula, don't just report a point
   estimate).
```

---

## 7. Convert & Package for Edge Deployment — CLAUDE CODE PROMPT #4

Once you've downloaded your trained adapter weights locally:

```
Convert the fine-tuned LoRA adapter(s) at [path to your downloaded
lora_adapter_* folders] for on-device deployment:

1. Merge each LoRA adapter into the base model weights.
2. Convert to ONNX format via ONNX Runtime's conversion tooling, applying
   INT4 quantization for the mobile deployment target.
3. If using the LoRA ensemble approach: package all merged/converted variants
   together with a lightweight majority-vote aggregation wrapper, so the
   on-device inference call is a single function returning one final
   structured output, not something the calling app code has to orchestrate
   across multiple model calls itself.
4. Report the final on-device package size (model + aggregation wrapper) so
   it can be checked against the 2GB RAM / <100MB app-size targets before
   proceeding to integration.
5. Run a basic correctness check: same test-set predictions before and after
   ONNX conversion/quantization should match closely — report any accuracy
   drop introduced by quantization specifically, since that's a real,
   separate source of degradation from the fine-tuning itself.
```

---

## 8. Integrate Into the Backend — CLAUDE CODE PROMPT #5 (final, consolidated)

```
Integrate the converted edge model (from the previous step) as the offline
backend of the Reasoning Engine.

1. Build the on-device retrieval store: a compact, compressed subset of the
   RAG Knowledge Engine corpus (the same WHO IMCI/ETAT/IMAI documents used
   for training data prep), bundled with the app rather than queried over a
   network — this is required because the edge model needs grounding context
   available even with zero connectivity, which rules out reaching a
   server-hosted vector store. Use the same clause-level chunking approach
   as the server-side corpus, just a smaller, on-device-sized index.

2. Wire the edge model into the offline backend slot of the Reasoning Engine:
   same input contract, same output schema (severity_tier, confidence,
   reasoning, grounding_reference) as the online hosted-cascade backend —
   the rest of the system must not need to know or care which backend
   answered a given request.

3. Implement the same mechanical grounding verification the online backend
   uses: the edge model's grounding_reference must be checked against the
   on-device retrieval store's actual chunk content before the result is
   trusted, exactly the same discipline as the server-side verifier, not a
   simplified or skipped version for the offline path.

4. Implement the same abstention rule as the online backend: below the
   calibrated confidence floor established in the evaluation harness step,
   the output is always "consult soon," never "routine" — a single, testable
   rule, not implicit model behavior.

5. Add adversarial and grounding tests for the offline path specifically,
   mirroring whatever test coverage exists for the online cascade's
   equivalent path — this needs its own verification, not an assumption that
   passing online tests implies the offline path also works.

6. Confirm the full offline flow works with the device's network connection
   actually disabled during testing, not just assumed — safety gate, edge
   model inference, on-device retrieval, and grounding verification all
   functioning with zero connectivity.

Report: final integration test results, on-device package size, and confirm
the calibration/abstention behavior matches what the evaluation harness
established as the correct threshold.
```

---

## 9. Final End-to-End Checklist

- [ ] Base model chosen after testing real device memory constraints (Section 1)
- [ ] Training data acquired (Section 2)
- [ ] Data prepared, and **you** have personally reviewed the `needs_clinical_review.jsonl` queue (Section 3)
- [ ] Training run completed by you in Colab/Kaggle, adapter weights downloaded (Sections 4-5)
- [ ] Calibration harness run, honest confidence-interval statement produced, not a bare point estimate (Section 6)
- [ ] Model converted to ONNX, quantization accuracy-drop measured (Section 7)
- [ ] Integrated into the offline Reasoning Engine backend with full test coverage, tested with the network actually disabled (Section 8)
- [ ] No claim about accuracy or hallucination rate stated anywhere (pitch, PPT, demo script) beyond what Section 6's actual measured sample size supports
