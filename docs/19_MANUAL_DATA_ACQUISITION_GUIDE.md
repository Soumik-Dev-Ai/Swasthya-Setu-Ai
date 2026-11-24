# Document 19 — Manual Data Acquisition & Fine-Tuning Execution Guide

**Why this document exists:** `18_MASTER_BACKEND_IMPLEMENTATION_PROMPT.md` tells your coding agent *what to build* — the ingestion pipeline, the retrieval service, the training script. It does not, and cannot, guarantee that the raw source data and the fine-tuning execution itself happen automatically. This document is the checklist for the parts that are genuinely yours to do.

## 0. Division of Labor — read this table first

| Task | Who does it | Why |
|---|---|---|
| Write the ingestion pipeline code (chunking, embedding, pgvector writes) | Claude Code | Pure code, no external account/credential needed |
| Fetch the actual WHO/government source PDFs | **You** (unless you've confirmed your Claude Code session has verified internet access — see §1.1) | Requires either internet access the agent may not have, or judgment about which document version is the one you want |
| Write the LoRA fine-tuning script | Claude Code | Pure code |
| Run the fine-tuning job (first pass) | **You** | Interactive supervision matters for catching data/hyperparameter issues early, even where automation is technically possible — see `23_COMPLETE_FINETUNING_TRAINING_GUIDE.md` §4 |
| Run the fine-tuning job (later re-runs, Kaggle only) | Can move to your agent, **if** it has verified API access to kaggle.com and your Kaggle token is configured | Kaggle (not Colab) has a genuine CLI-driven kernel execution path — `23_COMPLETE_FINETUNING_TRAINING_GUIDE.md` §4 has the exact commands |
| Convert Kaggle datasets from source to usable format | Claude Code, once you've downloaded them | Code, but needs the raw file present first |
| Download the Kaggle dataset itself | **You** | Requires your Kaggle account/API key |
| Write the government ETL extraction/verification code | Claude Code | Pure code |
| Fetch the actual PM-JAY/CGHS/state portal documents | **You** | Same reason as the RAG sources |
| Convert the trained LoRA adapter to ONNX for on-device deployment | Claude Code, once you've handed it the trained weights | Code, but needs the actual output file from your training run first |

**The pattern across every row:** anything that's pure code, hand to Claude Code. Anything that requires an external account, a browser, or a judgment call about which real-world document is authoritative, is on you — and doc 18 was written knowing that, which is why it treats "ingest the corpus" as starting from files that already exist locally, not as a promise to go find them.

## 1. RAG Corpus Acquisition (`14_RAG_SYSTEM_DESIGN.md` §1 — MVP scope)

### 1.1 First, check whether you can skip most of this manual work

Ask Claude Code directly: *"Do you currently have internet/web-fetch access in this environment?"* If yes, you can ask it to attempt the downloads in §1.2 itself — but treat this as an optimization to try, not something to assume works, and always spot-check what it actually retrieved against the exact sources below before trusting it in the corpus. If no, or you're unsure, do §1.2 yourself.

### 1.2 Documents to download (MVP scope — WHO IMCI + ETAT + your tracked conditions)

| Document | Where to get it | What to do |
|---|---|---|
| WHO IMCI Chartbooks | Search "WHO IMCI chart booklet" on who.int/publications — download the official PDF | Save as `docs_raw/who_imci_chartbook.pdf` |
| WHO IMAI District Clinician Manual (adult/adolescent illness — the counterpart to IMCI) | who.int/publications/i/item/9789241548281, direct PDF at `apps.who.int/iris/bitstream/10665/77751/1/9789241548281_Vol1_eng.pdf` | Save as `docs_raw/who_imai_vol1.pdf` |

**Scope philosophy, added per team discussion:** IMCI (children) + ETAT (emergency) + IMAI (adults/adolescents) together give broad, symptom-first coverage across nearly every common presenting complaint — this is the correct way to avoid being "limited to specific diseases," rather than trying to acquire a document per disease, which has no natural stopping point. Expand further only when real testing against `09_QA_TEST_PLAN.md`'s adversarial suite surfaces an actual gap these three don't cover — demand-driven, not pre-emptive.
| MoHFW Standard Treatment Guidelines / IPHS | **Not on MoHFW's general site or data.gov.in** — use the National Health Mission index at `https://nhm.gov.in/index1.php?lang=1&level=1&sublinkid=284&lid=154`, or the direct 2022-revised PDFs: Sub Health Centre `nhsrcindia.org/sites/default/files/SHC-HWC%20%26%20UHWC%20IPHS%202022%20Guidelines%20pdf.pdf`, PHC `nhsrcindia.org/sites/default/files/PHC%20IPHS_2022_Guideline_pdf.pdf`, CHC `nhsrcindia.org/sites/default/files/CHC%20IPHS%202022%20Guidelines%20pdf.pdf` | Save each facility-tier guideline as `docs_raw/iphs_[tier].pdf` |
| ICMR guidelines relevant to your 17 triage conditions | **`icmr.gov.in/guidelines` is a large index of ~30 unrelated categories (Ethics, Stem Cell Research, Gene Therapy, Cancer, etc.), not a document itself — most of it doesn't match this project's scope.** After checking, the only genuinely relevant entries found were the Type 1 and Type 2 Diabetes management guidelines (useful for the chronic-follow-up flag, FR-11): `icmr.gov.in/icmrobject/custom_data/pdf/resource-guidelines/ICMR_Guidelines_for_Management_of_Type_1_Diabetes.pdf` and `.../ICMR_GuidelinesType2diabetes2018_0.pdf`. For your actual 10 tracked diseases, WHO IMCI/ETAT and MoHFW/NHM Standard Treatment Guidelines remain the primary sources — don't expect ICMR to fill that gap. | Save as `docs_raw/icmr_type1_diabetes.pdf` and `docs_raw/icmr_type2_diabetes.pdf` |

**Create a `docs_raw/` folder in your repo, place every downloaded file there with the exact naming pattern above, and only then run Phase 3 of `18_MASTER_BACKEND_IMPLEMENTATION_PROMPT.md`** — the ingestion pipeline should read from this folder, not attempt to fetch documents mid-pipeline.

### 1.3 A note on staying within the source governance rules

Every download must come from the official organization's own site — not a mirror, not an aggregator, not a forum repost. If you can't find an official PDF through the organization's own publications page, that document doesn't go in the corpus yet; flag it and move on, per `14_RAG_SYSTEM_DESIGN.md` §1's exclusion rule for anything you can't verify the provenance of.

## 2. Government Financial ETL Source Acquisition (`16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md` §2.1)

Same pattern as §1 — download, don't assume auto-fetch:

| Source | Where | What to grab |
|---|---|---|
| PM-JAY HBP Master List | pmjay.gov.in, Health Benefit Packages section | Latest published HBP PDF/spreadsheet |
| CGHS Rate List | cghs.nic.in | Latest city-wise rate list PDF |
| **All 28 states + 8 UTs** (expanded from the original 4) | See `21_state_scheme_registry.csv` for scheme names identified so far, and `download_state_schemes.py` to fetch anything with a verified URL | This is a rolling task — the registry currently has names for 17/36 and verified official URLs for 0/36. Fill in `official_portal_url` as each one gets verified (by you, your agent if it has internet access, or in a follow-up research pass), then re-run the script — it only attempts what's actually populated, never guesses. |

Save these to `docs_raw/financial/` with the source name and the date you downloaded them in the filename (e.g., `cghs_rates_2026-09.pdf`) — this download date matters for the automated recency resolution logic in doc 16 §2.2, so don't skip labeling it. State scheme downloads go to `docs_raw/financial/states/` per the script's default.

**Note on West Bengal specifically:** it joined AB-PM-JAY in May 2026 after years of running outside it — re-verify the WBHS/Swasthya Sathi/PM-JAY relationship before treating any single document as the current source of truth for that state (`16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md` §2.1).

## 3. Fine-Tuning Data Preparation (`13_FINE_TUNING_TRAINING_PLAN.md` §3)

| Data source | Your steps |
|---|---|
| Kaggle Symptom-Disease Prediction dataset | 1. Create a free Kaggle account. 2. Go to your Kaggle account settings → API → "Create New Token" (downloads `kaggle.json`). 3. Install the Kaggle CLI (`pip install kaggle`) locally or in your Colab notebook. 4. Place `kaggle.json` per Kaggle's setup instructions. 5. Run `kaggle datasets download -d itachi9604/disease-symptom-description-dataset` (confirm the exact slug still matches on the dataset's Kaggle page — slugs occasionally change owners). 6. Hand the downloaded CSV to Claude Code for the relabeling step already specified in `06_AI_MODEL_SPEC.md` §3. |
| WHO IMCI/ETAT guideline-grounded instruction pairs | This is genuinely joint work: you supply the source text (already downloaded in §1.2), and Claude Code can draft candidate instruction-tuning pairs from it — but a clinician or your Clinical Mentor Review phase (`08_ROADMAP_EXECUTION_PLAN.md`) needs to actually check these before they're used in training, per the human-review requirement already specified for translated/derived safety-relevant content. |
| AI4Bharat multilingual resources | 1. Create a free Hugging Face account. 2. Search "ai4bharat" on huggingface.co. 3. Use `huggingface-cli download` (requires `pip install huggingface_hub` and running `huggingface-cli login` with a token from your HF account settings) to pull the specific model/dataset you need. |

## 4. Running the Fine-Tuning Job Yourself

This is the step that most needs to be said plainly: **you will be the one sitting in front of a Colab or Kaggle notebook, not Claude Code.**

1. Go to colab.research.google.com (or kaggle.com/code for Kaggle Notebooks) and sign in with your account.
2. Create a new notebook. Under Runtime → Change runtime type, select a GPU (Colab's free tier gives you a time-limited T4 GPU; Kaggle gives roughly 30 GPU-hours/week free — check current limits on each platform, they change).
3. Ask Claude Code to write you the actual LoRA fine-tuning script (using the Unsloth + TRL approach and hyperparameters from `13_FINE_TUNING_TRAINING_PLAN.md` §2.2) as a notebook-ready `.ipynb` or a plain `.py` you can paste into cells.
4. Upload your prepared training data (from §3 above) to the notebook environment — either via Colab's file upload, or by mounting Google Drive, or Kaggle's dataset attachment feature.
5. Run the training cells yourself, watch for errors, and re-run as needed — this is an interactive process, not a fire-and-forget job.
6. When training completes, **download the resulting LoRA adapter weights** to your own machine.
7. Bring those weight files back into your project repository and hand them to Claude Code for the next step (ONNX conversion and on-device packaging, per `13_FINE_TUNING_TRAINING_PLAN.md` §2.1) — this part *is* back in coding-agent territory, since it's local file conversion, not cloud GPU training.

## 5. Quick Checklist Before You Tell Claude Code to Start Phase 3 of Doc 18

- [ ] `docs_raw/` populated with the WHO/MoHFW/ICMR PDFs from §1.2
- [ ] `docs_raw/financial/` populated with the PM-JAY/CGHS/state documents from §2, correctly dated in the filename
- [ ] Kaggle dataset downloaded and available locally (§3)
- [ ] AI4Bharat resources pulled if you're using them for multilingual augmentation (§3)
- [ ] Fine-tuning is understood as a separate, later, manual step (§4) — don't expect Phase 3 of doc 18 to produce a trained edge model; it produces the RAG and ETL pipelines that don't require your personal GPU session

If any box above isn't checked, Phase 3 will either stall waiting for files that don't exist, or Claude Code will (reasonably) ask you where the source data is — better to have it ready than to discover the gap mid-phase.
