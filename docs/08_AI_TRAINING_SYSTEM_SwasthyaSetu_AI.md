# AI Training System — Self-Contained Master Specification
## SwasthyaSetu AI: Symptom Detection & Scheme/Insurance Cost-Matching Models

**Document type:** Standalone build spec. This document does not assume the reader has access to any other project document. Everything needed to understand the project, build the models, evaluate them, and hand off working, integration-ready deliverables is contained here.

---

## 0. How to Use This Document

**If you are an AI assistant** (e.g., Claude, ChatGPT, or any other model) being given this document by a person building this: your job is to act as their technical guide through this entire build. Concretely:
- Read Sections 1–4 first to understand the product, the users, and the non-negotiable safety rules. Do not skip these — the safety rules in Section 4 constrain every technical decision that follows, and violating them (e.g., letting a model auto-clear an emergency case) is a critical failure even if the model's overall accuracy looks good.
- Use Section 7 (Step-by-Step Execution Plan) as your primary checklist. Walk the person through it step by step, in order. Do not jump ahead to model training before the dataset and label taxonomy (Sections 5 and 6) are settled.
- Use Sections 5, 6, 8, 9, and 15 as your reference material when the person asks "how do I actually do step X" — they contain schemas, example data, and code skeletons you should adapt (not blindly copy) to their actual tools and environment.
- Use Section 12 (Definition of Done) as the acceptance test before telling the person the work is complete.
- If the person's environment, tooling, or dataset access differs from what's assumed here, adapt the *approach* while preserving the *non-negotiable rules* in Section 4 and the *API contract* in Section 9 — those two things must not change regardless of implementation details, because the rest of the product (built separately by a platform team) is being built against that exact contract.

**If you are the human teammate:** read Sections 1–4 once fully before starting anything. Then follow Section 7 top to bottom. Sections 5, 6, 8–11, and 15 are your working reference — you'll come back to them repeatedly during the actual build, not read them once and forget them.

---

## 0.1 Master Kickoff Prompt (Copy-Paste This Into Any AI to Start)

The teammate can paste the block below, verbatim, into the very start of a new conversation with any AI assistant (Claude, ChatGPT, Gemini, etc.), together with this entire document pasted or uploaded alongside it. This is the trigger that puts the AI into "guide me step by step" mode.

```
You are my AI/ML build partner for a hackathon project. I am attaching/pasting a
document called "AI Training System — Self-Contained Master Specification" for a
project called SwasthyaSetu AI. This document contains everything you need:
project context, safety rules, dataset schemas, modeling approach, evaluation
bars, API contract, code skeletons, a step-by-step execution plan, and a list
of official government data sources with download links (Section 6.8). I also
have two bundled starter data files referenced in Section 0.2 of the document
(09_STARTER_track_a_symptom_seed_data.json and
10_STARTER_track_b_scheme_dataset.json) — I will share these with you too when
we get to the data steps.

IMPORTANT ABOUT ME: I have little to no prior experience training AI models.
I may not know what things like "embeddings," "fine-tuning," "virtual
environment," "API," or "terminal command" mean. Please:
- Never assume I know a term — explain it in one plain sentence the first time
  you use it.
- Give me literal, copy-pasteable commands and exact file names, not vague
  instructions like "set up your environment."
- Ask me to confirm the result of each step (e.g., "paste what you see on
  screen") before moving to the next one.
- Break every step in Section 7 into smaller sub-steps if needed — I would
  rather do 20 tiny steps correctly than 5 big ones incorrectly.
- If something fails or errors out, help me debug it patiently, one thing at
  a time.

Your job:
1. Read the whole document first, especially Section 4 (non-negotiable safety
   rules), Section 6.8 (official data source list), and Section 7 (step-by-step
   execution plan).
2. Then act as my hands-on guide. Walk me through Section 7 one step at a time,
   in the smallest sub-steps possible given that I'm a beginner. Do not skip
   ahead. Before each step, tell me exactly what to do, exactly what command or
   click to make, and why.
3. When I show you data, code, or results, check them against the schemas,
   thresholds, and rules in the document (especially Section 4 and Section 10)
   and tell me clearly if something violates a rule or misses a target — don't
   just say "looks good."
4. Help me generate/expand datasets following the schema and examples in
   Sections 5 and 6 when I ask for more data, and help me actually download and
   use the official datasets listed in Section 6.8 — tell me exactly what to
   click and what to do with the file once it's downloaded.
5. Help me write, debug, and adapt the code in Sections 8, 9, and the training
   scripts when I ask — give me full, ready-to-run code, not fragments I have
   to piece together myself.
6. Before declaring anything "done," check it against Section 12 (Definition
   of Done) explicitly, item by item.
7. When everything is done, walk me through Section 17 (Final Packaging &
   Handoff) exactly, so I package the right files correctly to send back to my
   project lead.
8. If I try to skip the safety rules in Section 4 (e.g., "let's just let the
   model decide emergencies directly, it's faster"), push back and explain why,
   citing the relevant rule number.

Start by summarizing back to me, in your own words and in simple language,
what this project is, what I'm building, and what the very first small
sub-step is. Then wait for my confirmation before we begin.
```

This single prompt is enough — the AI does not need any other file, message, or context from this project to be useful from that point forward.

---

## 0.2 Bundled Starter Files (Included Alongside This Document)

This document ships with two ready-to-use starter data files so the teammate is not starting from a blank folder:

- **`09_STARTER_track_a_symptom_seed_data.json`** — ~35 pre-labeled Track A examples following the exact schema in Section 5.3, covering all three urgency tiers and most symptom categories. Use it as the seed for Section 5.5's data collection process — load it directly into your training pipeline as your first ~35 rows, then expand.
- **`10_STARTER_track_b_scheme_dataset.json`** — a starter structured scheme dataset (Section 6.3 schema) covering PM-JAY, PMBJP, AMRIT, and Ayushman Arogya Mandir, plus a starter set of query-to-scheme matching pairs (Section 6.4 schema).

**Important:** both files are explicitly marked `PLACEHOLDER` on their `last_verified_date`/source-verification fields. Per Section 4, Rule 4 (never fabricate scheme/pricing data), the teammate must verify each scheme entry against an official source before this dataset is used in anything beyond early prototyping — the starter file gives you the correct *shape and starting content* to verify against, not a substitute for that verification.

---

## 1. Project Context (Self-Contained Background)

### 1.1 What is SwasthyaSetu AI
SwasthyaSetu AI ("Bridge to Health") is a rural-India-focused digital health platform being built for Smart India Hackathon (SIH) 2026. It is **not** a general symptom-checker app like Practo or Ada. Its core differentiator is that it doesn't just tell a user what might be wrong — it tells them **where to go and what it will actually cost them**, routing them to the correct tier of care (Sub-Centre → PHC → CHC → PM-JAY-empaneled hospital) and to subsidized medicine sources (PMBJP/AMRIT pharmacies), with a computed cost estimate.

The product is being built in two stages:
- **Stage 1 (current focus):** A website prototype proving the full logic end-to-end.
- **Stage 2 (later):** A React Native mobile app with an on-device, offline-capable AI engine for low-end (2GB RAM) smartphones.

### 1.2 The Problem Being Solved (Key Facts)
- Rural India has a severe healthcare workforce shortage: 18.8% PHC doctor vacancy, 51.6% specialist vacancy in Community Health Centres.
- 70%+ of rural primary care is delivered by informal, non-degree providers — not because of ignorance, but because they're the only accessible option.
- Out-of-pocket healthcare expenditure (OOPE) is 39.4% of total health spending in India; **42.9% of that OOPE goes to retail pharmacy purchases alone** — routine medicine costs, not hospitalizations, are the biggest financial drain on families.
- Existing digital health apps (Practo, Ada-style symptom checkers) tell users *what disease they might have* but never *how to afford treatment* — they don't connect users to government schemes (PM-JAY, PMBJP, AMRIT) or compute real costs.
- Government schemes exist and are well-funded (PM-JAY provides ₹5 lakh/family/year cover for ~55 crore beneficiaries) but are poorly navigated by the people who need them most.

**This is why the AI you're building matters:** it is the component that (a) understands what a rural user is describing in their own words/language and (b) matches their situation to the correct subsidized care path and cost estimate — the exact gap the research found no existing product fills.

### 1.3 Users the Model Must Work For
- **Rural patients:** low-to-medium literacy, speak regional languages/dialects (not English), often type in Hinglish/Banglish (romanized regional language) or use voice input, cannot afford unnecessary private care.
- **ASHA workers (community health workers):** use low-RAM government or personal smartphones, need speed and simplicity, not more training burden.
- **Informal/rural medical practitioners:** no formal medical degree, benefit from decision-support checklists rather than autonomous diagnosis.

### 1.4 Hard Technical Constraints
- Stage 2 target device: **2GB RAM, target app size under 100MB.**
- Connectivity is unreliable/absent in the field — the eventual on-device model must run with **zero internet dependency**.
- Users interact primarily via **voice**, often in regional languages, often with non-standard/colloquial phrasing.

### 1.5 Where Your Models Fit in the Product
The wider system (built separately by a platform team) has two consumer services that will call your trained models:
- **Symptom Triage Service** — collects user symptom input, calls your Track A model, then passes the result through a **deterministic, non-AI rule-based safety layer** that makes the final call on whether something is an emergency.
- **Cost-Aware Routing Engine** — collects the user's situation, calls your Track B model to find matching schemes, then runs a **deterministic arithmetic calculator** (not AI-generated) to compute the final estimated out-of-pocket cost.

**You are building the AI layer that feeds these two services. You are not building the safety layer or the cost calculator — those are deliberately kept as plain, auditable code, not AI, for safety and accuracy reasons explained in Section 4.**

---

## 2. Your Mission — What "Done" Looks Like

By the end of this workstream, you must deliver:
1. Two trained, evaluated models (Track A: symptom/triage; Track B: scheme/cost matching).
2. Both models wrapped in a running API service matching the exact contract in Section 9.
3. A written evaluation report proving the models meet the safety and accuracy bars in Section 10.
4. Versioned, documented datasets and training code that someone else could re-run.
5. A packaging/export step preparing the models for later on-device (mobile) deployment.

The full checklist against which this work will be judged "complete" is in **Section 12**.

---

## 3. Glossary (So Nothing in This Doc Is Ambiguous)

| Term | Meaning |
|---|---|
| **Triage** | The process of sorting a symptom report into an urgency category |
| **Urgency tier** | One of three output levels: `EMERGENCY`, `CONSULT_SOON`, `SELF_CARE_ADVISORY` |
| **Red-flag symptom** | A symptom that must always trigger an EMERGENCY classification (e.g., severe chest pain), checked by a fixed rule list, never left to the AI's judgment alone |
| **OOPE** | Out-of-Pocket Expenditure — money a patient pays directly, not covered by insurance/scheme |
| **PM-JAY** | Ayushman Bharat Pradhan Mantri Jan Arogya Yojana — India's major public health insurance scheme (₹5 lakh/family/year cover) |
| **PMBJP / AMRIT** | Government-run pharmacy networks selling generic/subsidized medicines |
| **Empaneled hospital** | A hospital officially registered to provide cashless treatment under PM-JAY |
| **Confidence score** | A 0–1 number the model outputs alongside its prediction, indicating how sure it is |
| **Fallback** | What the system does when the model is unavailable or unsure — always a safe, conservative default, never a blank/broken response |
| **On-device / edge AI** | A model small and efficient enough to run directly on a phone, with no internet or server call needed |
| **Hallucination** | When a model generates plausible-sounding but false information (e.g., inventing a scheme that doesn't exist) — this is explicitly forbidden output behavior for this system |

---

## 4. Non-Negotiable Safety & Ethics Rules (Embedded — Read Before Building Anything)

These rules override any modeling convenience. They exist because this system touches real health and financial decisions for vulnerable users.

1. **The AI never makes the final emergency/non-emergency decision.** Your Track A model outputs a *suggested* urgency signal with a confidence score. A separate, deterministic rule-based checklist (maintained outside your model, using a fixed list of red-flag symptoms reviewed against clinical guidelines) has final override authority. Your model must never be designed or evaluated as if its own judgment is the last word on safety.
2. **The AI never outputs a named diagnosis.** Output only symptom *categories* (e.g., "respiratory", "gastrointestinal") — never disease names like "you have pneumonia."
3. **The AI never outputs a medicine name or dosage.** Track B routes users to pharmacies (PMBJP/AMRIT); it never recommends what medicine to take or how much.
4. **The AI never fabricates scheme, pricing, or eligibility data.** All scheme/cost facts must come from a curated, verified dataset (built by you or handed to you — see Section 6.3) — never generated as free text by a language model. If you use an LLM anywhere in Track B, it may only be used to *match* a user's query to an entry in the verified dataset (retrieval), never to *generate* a new fact.
5. **The final cost number is always computed by plain arithmetic code, never by a model.** Your job for Track B ends at "which scheme(s) apply" — the actual subtraction (`Total Cost − Insurance − Scheme Benefit`) is done outside your model.
6. **When uncertain, default to the safer/more conservative output.** For Track A, uncertainty defaults toward `CONSULT_SOON`, never a false "you're fine." For Track B, uncertainty defaults to showing multiple possible matches rather than confidently picking a wrong one.
7. **Training data privacy.** Never train on real, identifiable user data (real names, real uploaded insurance documents, real patient records) without explicit, documented consent and anonymization. Use public datasets, synthetic data, or team-authored examples instead — this is sufficient and expected for this build.
8. **Every model response must include a version identifier and a confidence score.** This is required for audit logging elsewhere in the system — do not skip it, even in an early prototype.
9. **Emergency-case recall is evaluated and reported separately from overall accuracy, and is the top-priority metric.** A model that is 95% accurate overall but misses 1 in 10 emergency cases is a failed model for this project, even though 95% sounds good. See Section 10.

---

## 5. Track A — Symptom Detection / Triage Model

### 5.1 Objective
Input: a piece of text (typed or transcribed-from-voice) describing symptoms, in a supported language, possibly informal/colloquial.
Output: a **symptom category** and a **suggested urgency tier**, each with a confidence score.

### 5.2 Label Taxonomy (Use Exactly This Unless You Have a Documented Reason to Change It)

**Symptom categories** (extend this list as needed, but keep it consistent across the whole dataset):
`respiratory`, `gastrointestinal`, `cardiovascular`, `maternal_health`, `pediatric`, `injury_trauma`, `fever_infectious`, `musculoskeletal`, `mental_health`, `chronic_ncd` (diabetes/hypertension follow-up), `dermatological`, `ophthalmic`, `other`

**Urgency tiers** (fixed — do not add more than these three, the rest of the system is built around exactly these three values):
- `EMERGENCY` — needs immediate care (e.g., chest pain, severe breathlessness, heavy bleeding, signs of stroke, seizures, severe abdominal pain in pregnancy, high fever with convulsions in a child)
- `CONSULT_SOON` — needs a professional visit but is not immediately life-threatening (e.g., persistent fever, ongoing pain, unexplained weight loss)
- `SELF_CARE_ADVISORY` — minor/self-limiting (e.g., mild cold symptoms, minor cuts, mild headache)

### 5.3 Dataset Schema
Each row/example in your Track A dataset must have these fields:

```json
{
  "id": "string, unique",
  "text": "the symptom description, exactly as a user might type/say it",
  "language": "ISO code or label, e.g. 'hi', 'bn', 'hinglish'",
  "symptom_category": "one value from the taxonomy above",
  "urgency_tier": "EMERGENCY | CONSULT_SOON | SELF_CARE_ADVISORY",
  "source": "where this example came from (public_dataset / synthetic / team_authored)",
  "label_basis": "which clinical guideline or reasoning justifies this label (cite something specific, don't leave this blank)"
}
```

**`label_basis` is not optional.** Every label needs a traceable reason — either a specific clinical protocol reference (e.g., WHO Integrated Management of Childhood Illness guidelines, or Indian Public Health Standards) or, at minimum, a clear internal team rationale document. This is what makes the dataset auditable later if a mislabel is found.

### 5.4 Example Labeled Rows (Use as a Pattern to Generate More)

| text | language | symptom_category | urgency_tier |
|---|---|---|---|
| "chest mein bahut dard ho raha hai aur saans nahi aa rahi" | hinglish | cardiovascular | EMERGENCY |
| "mera bacha 3 din se tez bukhar mein hai, khana nahi kha raha" | hinglish | pediatric | CONSULT_SOON |
| "halka sa sar dard hai, neend nahi aayi thi" | hinglish | other | SELF_CARE_ADVISORY |
| "pregnant hoon, pet mein bahut tez dard aur khoon aa raha hai" | hinglish | maternal_health | EMERGENCY |
| "khaansi hai 2 hafte se, bukhar bhi hai" | hinglish | respiratory | CONSULT_SOON |
| "ungli kat gayi thi, khoon zyada nahi aa raha" | hinglish | injury_trauma | SELF_CARE_ADVISORY |
| "bahut chakkar aa rahe hain aur ek taraf ka haath sunn ho gaya hai" | hinglish | other | EMERGENCY |
| "sugar patient hoon, dawai khatam ho gayi hai" | hinglish | chronic_ncd | CONSULT_SOON |

Build several hundred to a few thousand examples following this pattern before training — see Section 5.6 for how to scale this up. **A ready-to-load starter file with 35 pre-labeled examples in this exact format is bundled as `09_STARTER_track_a_symptom_seed_data.json` — see Section 0.2.**

### 5.4a Extended Bootstrap Seed Set (30 More Rows to Get Started Immediately)
Use this larger seed batch as a `.csv` starting point (columns: `id,text,language,symptom_category,urgency_tier`) so training code can be run and tested on day one, before the full dataset (Section 5.5) is built:

```csv
id,text,language,symptom_category,urgency_tier
a001,chest mein bahut dard ho raha hai aur saans nahi aa rahi,hinglish,cardiovascular,EMERGENCY
a002,mera bacha 3 din se tez bukhar mein hai khana nahi kha raha,hinglish,pediatric,CONSULT_SOON
a003,halka sa sar dard hai neend nahi aayi thi,hinglish,other,SELF_CARE_ADVISORY
a004,pregnant hoon pet mein bahut tez dard aur khoon aa raha hai,hinglish,maternal_health,EMERGENCY
a005,khaansi hai 2 hafte se bukhar bhi hai,hinglish,respiratory,CONSULT_SOON
a006,ungli kat gayi thi khoon zyada nahi aa raha,hinglish,injury_trauma,SELF_CARE_ADVISORY
a007,bahut chakkar aa rahe hain aur ek taraf ka haath sunn ho gaya hai,hinglish,other,EMERGENCY
a008,sugar patient hoon dawai khatam ho gayi hai,hinglish,chronic_ncd,CONSULT_SOON
a009,pet mein halka dard hai khana khane ke baad theek lagta hai,hinglish,gastrointestinal,SELF_CARE_ADVISORY
a010,bahut zor se ulti ho rahi hai aur pet mein asahaniya dard hai,hinglish,gastrointestinal,EMERGENCY
a011,ghutno mein dard hai jab seedhi chadte hain,hinglish,musculoskeletal,CONSULT_SOON
a012,skin par laal daane ho gaye hain khujli ke saath,hinglish,dermatological,SELF_CARE_ADVISORY
a013,aankhon se dhundhla dikh raha hai kuch dinon se,hinglish,ophthalmic,CONSULT_SOON
a014,bahut ghabrahat aur bechaini rehti hai neend nahi aati,hinglish,mental_health,CONSULT_SOON
a015,bacha seedi se gir gaya sar se khoon beh raha hai,hinglish,injury_trauma,EMERGENCY
a016,BP high rehta hai dawai time par leta hoon,hinglish,chronic_ncd,SELF_CARE_ADVISORY
a017,saans phool rahi hai thodi si mehnat mein,hinglish,respiratory,CONSULT_SOON
a018,mujhe achanak seene mein jakdan aur paseena aa raha hai,hinglish,cardiovascular,EMERGENCY
a019,gale mein kharash aur halka bukhar hai,hinglish,respiratory,SELF_CARE_ADVISORY
a020,delivery ke baad se bahut zyada bleeding ho rahi hai,hinglish,maternal_health,EMERGENCY
a021,bukhar 5 din se nahi utar raha hai,hinglish,fever_infectious,CONSULT_SOON
a022,halka bukhar hai lekin thakaan bhi hai,hinglish,fever_infectious,SELF_CARE_ADVISORY
a023,bacha bahut tez bukhar mein jhatke le raha hai,hinglish,pediatric,EMERGENCY
a024,peeth mein dard hai bhaari samaan uthane ke baad,hinglish,musculoskeletal,SELF_CARE_ADVISORY
a025,pesab mein jalan aur baar baar jaana pad raha hai,hinglish,other,CONSULT_SOON
a026,achanak ek aankh se dikhna band ho gaya,hinglish,ophthalmic,EMERGENCY
a027,i have had a mild headache and slight fatigue since yesterday,en,other,SELF_CARE_ADVISORY
a028,my father is unconscious and not responding to us,en,other,EMERGENCY
a029,persistent cough for over three weeks with occasional blood,en,respiratory,CONSULT_SOON
a030,minor scrape on the knee from a fall while playing,en,injury_trauma,SELF_CARE_ADVISORY
```

Treat this as a starting fixture for pipeline testing, not as a sufficient training set on its own — it is far too small and too English/Hinglish-skewed to ship; it exists so the code in Section 8/9 can be run and validated end-to-end on day one while the real data collection (Section 5.5) continues in parallel.

### 5.5 Data Collection Plan — Step by Step
1. **Start with the official real-world datasets in Section 5.5a below** (this replaces guessing at "some public dataset somewhere" — these are the actual, verified sources for this project) as a structural base — these give you sentence patterns and category diversity even though the language/phrasing will need adaptation.
2. **Translate and "de-formalize" into target languages.** Clinical-sounding English symptom descriptions must be rewritten into the colloquial, code-mixed way real users would actually type or say them (see the example rows above — this is the single highest-value effort in this whole track).
3. **Generate synthetic variations.** For each core symptom scenario, write or generate (via an LLM prompted specifically to paraphrase, not to invent new medical facts) 5–10 phrasing variants — different word choices, different levels of detail, with and without extra context (age, duration, pregnancy status, etc.).
4. **Label every example against the taxonomy in 5.2**, filling in `label_basis` honestly. If you are not a medical professional and have no advisor access, use a documented, consistent internal rule sheet (e.g., "any mention of chest pain + breathlessness together = EMERGENCY, cardiovascular") and note that this is a team-authored heuristic, not a clinical citation — this transparency matters more than pretending to false authority.
5. **Deliberately include hard/ambiguous cases** — multi-symptom inputs, vague inputs ("I don't feel well"), and inputs missing key details — labeled toward the conservative tier (`CONSULT_SOON` rather than a confident `SELF_CARE_ADVISORY`) per Rule 6 in Section 4.
6. **Target dataset size for a credible hackathon-stage model:** at minimum 500–1000 labeled examples per language, with deliberate over-representation of `EMERGENCY` examples relative to their real-world frequency (otherwise the model rarely sees them and performs poorly exactly where it matters most).

### 5.5a Official Dataset Sources — Exact Links & Download Instructions (Use These, Don't Guess)

These are the real, verified sources for this project. If an AI chatbot is walking you through this document, tell it which source you're working on and ask it to help you write the code to load/clean that specific file — you do not need to figure out the technical part alone.

**A. Disease Symptom Prediction Datasets (core Track A starting material)**
- **What it's for:** The base data mapping symptoms to conditions/urgency — this is the raw material you'll relabel using this document's taxonomy (Section 5.2).
- **Where:** `https://www.kaggle.com/datasets/itachi9604/disease-symptom-description-dataset` and `https://www.kaggle.com/datasets/karthikudyawar/disease-symptom-prediction/data`
- **How to download:** Create a free Kaggle account → open the link → click the "Download" button → you get a `.csv` file on your computer. That's it, no coding needed for this step.
- **What you'll need help with next:** relabeling each row into this project's 3 urgency tiers and category list (an AI can help you write a script to do a first-pass automatic mapping, which you then spot-check).

**B. National List of Essential Medicines (NLEM) 2022**
- **What it's for:** Keeps your system's cost/medicine logic honest — this is the government's official list of ~384 essential medicines with price caps, so your system never overestimates medicine cost or references a non-essential/uncapped drug where a cheaper essential alternative exists.
- **Where:** `https://nppa.gov.in/nlem2022` (NPPA website) — also mirrored on the CDSCO portal.
- **How to download:** Open the link, find the "National List of Essential Medicines 2022" document, click download — it's usually a PDF.
- **What you'll need help with next:** an AI can help you extract the medicine list from the PDF into a clean spreadsheet/JSON (this step, called "PDF extraction," is a very common task any AI coding assistant can walk you through).

**C. PMBJP (Jan Aushadhi) Product List & Prices — Track B foundation**
- **What it's for:** The actual subsidized generic-medicine prices your Cost-Aware Routing Engine and Track B model need to route users to affordable medicines.
- **Where:** `https://www.pmbi.co.in/ProductList.aspx` — also accessible via the "Jan Aushadhi Sugam" mobile app.
- **How to download:** Visit the page, view the product list, export/print to PDF (or copy the table if it's shown as a webpage table).

**D. Ayushman Bharat PM-JAY Health Benefit Packages (HBPs) — Track B foundation**
- **What it's for:** The official, government-capped treatment costs for medical procedures — this is what powers the actual OOPE (out-of-pocket cost) calculation described throughout this document.
- **Where:** `https://pmjay.gov.in` → "Resources" or "Health Benefit Packages" section.
- **How to download:** Navigate to that section on the PM-JAY or National Health Authority (NHA) site; the master list of procedures, package codes, and rates downloads as PDF or Excel.

**E. Socio-Economic Caste Census (SECC) 2011 Database — eligibility logic**
- **What it's for:** PM-JAY eligibility (who qualifies for the scheme) is based on this database's deprivation/occupational criteria — needed for your Track B model to correctly judge if a described situation matches PM-JAY eligibility.
- **Where:** `https://secc.dord.gov.in` (raw data parameters); for individual eligibility-style lookups, the PM-JAY beneficiary portal `beneficiary.nha.gov.in` shows how the parameters are actually used.
- **How to download:** The SECC portal hosts downloadable data; treat the beneficiary portal as your reference for *how* eligibility criteria get applied, since the raw census data alone can be dense to work with — an AI can help you translate the eligibility rules into a simple checklist for your `eligibility_criteria` field (Section 6.3).

**F. NHA Hospital Empanelment Module (HEM) & Health Facility Registry (HFR) — facility routing**
- **What it's for:** The real list of verified PM-JAY-empaneled hospitals and public facilities (PHCs/CHCs) your routing engine points users to.
- **Where:** `https://hospitals.pmjay.gov.in` (hospital search/empanelment) and `https://nhpr.abdm.gov.in/home` (Ayushman Bharat Digital Mission's national Health Facility Registry).
- **How to download:** Both are searchable web portals — for a starter dataset, manually search and export/copy results for your pilot district/state (per the wider project's Roadmap document, the MVP only needs one district/state's data, not the whole country).

**G. Common Drug Codes for India (SNOMED CT India Drug Extension)**
- **What it's for:** Standardizes drug/medicine names and codes across your system so "paracetamol," "Crocin," and other brand/generic variants are recognized as the same thing — useful if you ever need to match a user-mentioned medicine name to the NLEM/PMBJP price lists.
- **Where:** `https://www.nrces.in/services/national-releases` (National Resource Centre for EHR Standards).
- **How to download:** Register for a free Affiliate License via the Member Licensing & Distribution Service (MLDS) on that portal, then download the "Terminology Integrated Package" or "Flat Files Package." This one has a registration step — budget extra time for it, and it is not required for the MVP (treat it as a nice-to-have for later precision, not a blocker).

### 5.5b Additional Suggested Datasets (Not in the Original List, Worth Adding)

These fill gaps the list above doesn't cover — specifically, the multilingual/voice requirement (Section 1.3) and clinical safety-rule grounding (Section 4).

- **AI4Bharat datasets (IndicBERT, IndicTrans2, IndicVoices, Vaani)** — `https://ai4bharat.iitm.ac.in` — India's leading open NLP/speech research initiative, producing free datasets and models specifically for Indian languages including code-mixed/colloquial text and voice data. This is the single best resource for making Track A actually understand Hinglish/Banglish and other regional-language phrasing well, and for the Stage 2 voice-input pipeline. Downloadable directly from their website/Hugging Face pages, no registration needed for most datasets.
- **WHO Integrated Management of Childhood Illness (IMCI) guidelines** — search "WHO IMCI chart booklet" — a free, publicly available clinical protocol specifically for triaging childhood illness by symptom severity. This is a strong, citable source for the `label_basis` field on pediatric/emergency examples (Section 5.3), replacing "team heuristic" with an actual clinical guideline reference.
- **Open Government Data (OGD) Platform India** — `https://data.gov.in` — India's central open-data portal; useful for finding state-specific health scheme data and facility statistics beyond the national PM-JAY/PMBJP sources above, if your pilot district/state needs a state-level scheme entry (Section 6.3).
- **Rural Health Statistics (RHS) reports, Ministry of Health & Family Welfare** — search "Rural Health Statistics" on the Ministry's website — the official source for the facility-vacancy and infrastructure statistics already referenced in this project's research; useful if you need to justify or sanity-check your facility-tier routing logic (e.g., confirming a district's PHC/CHC counts).

### 5.6 Preprocessing
- Normalize text: lowercase, strip extra whitespace, but **do not strip away code-mixed spelling variants** — the model needs to see real messiness, not a cleaned-up version that won't match real input.
- Split into train/validation/test sets **stratified by both `urgency_tier` and `language`** so you don't accidentally end up with a test set missing all your EMERGENCY examples or missing a whole language.
- Reserve at least 15–20% of data as a held-out test set never touched during training or tuning.

### 5.7 Modeling Approach
Two complementary approaches — build both if time allows, but the lightweight classifier is the minimum viable deliverable:

**Approach 1 — Lightweight classifier (do this first, it's fast and gives you a working baseline):**
- Turn each `text` into a numeric vector using TF-IDF or pre-trained multilingual sentence embeddings (e.g., a multilingual `sentence-transformers` model).
- Train two classifiers on top: one predicting `symptom_category`, one predicting `urgency_tier` (or a single multi-output model).
- Tooling: `scikit-learn` (`LogisticRegression`, `RandomForestClassifier`, or `SVM` are all reasonable starting points), `sentence-transformers` for embeddings.
- This approach is small, fast to train, and easy to export — good for both the Stage 1 API service and eventual on-device use.

**Approach 2 — Fine-tuned transformer (do this if time/resources allow, for better nuance):**
- Fine-tune a small multilingual transformer classification model (e.g., a multilingual BERT-family model) on the same labeled data.
- Tooling: Hugging Face `transformers` + `datasets` libraries.
- More accurate on nuanced/ambiguous phrasing, but larger and slower — plan to quantize/compress this later for on-device use (Section 11).

**Minimum viable deliverable:** Approach 1, fully working and evaluated, wrapped in the API service (Section 9). Approach 2 is an upgrade, not a blocker.

### 5.7a Full Runnable Training Script — Approach 1 Baseline (`train_track_a.py`)
This is a complete, working starting point — not a fragment. Adapt file paths as needed; it runs end-to-end on the seed CSV in Section 5.4a and will keep working as you grow the dataset.

```python
"""
train_track_a.py
Trains the Track A symptom-category + urgency-tier classifier.
Run: python train_track_a.py
"""
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, recall_score
from sentence_transformers import SentenceTransformer

DATA_PATH = "data/track_a_symptoms/track_a_seed.csv"
MODEL_OUT_DIR = "models/triage-v0.1.0"
EMBED_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"  # multilingual, small, good baseline

def main():
    df = pd.read_csv(DATA_PATH)
    assert set(df["urgency_tier"].unique()) <= {"EMERGENCY", "CONSULT_SOON", "SELF_CARE_ADVISORY"}, \
        "Found an urgency_tier value outside the fixed taxonomy — fix the dataset before training."

    # Stratify by urgency_tier so EMERGENCY examples are represented in both splits
    train_df, test_df = train_test_split(
        df, test_size=0.2, random_state=42, stratify=df["urgency_tier"]
    )

    print(f"Train size: {len(train_df)} | Test size: {len(test_df)}")
    print("Loading multilingual embedding model (first run downloads it)...")
    embedder = SentenceTransformer(EMBED_MODEL_NAME)

    X_train = embedder.encode(train_df["text"].tolist(), show_progress_bar=True)
    X_test = embedder.encode(test_df["text"].tolist(), show_progress_bar=True)

    y_urgency_train = train_df["urgency_tier"]
    y_urgency_test = test_df["urgency_tier"]
    y_category_train = train_df["symptom_category"]
    y_category_test = test_df["symptom_category"]

    urgency_clf = LogisticRegression(max_iter=1000, class_weight="balanced")
    urgency_clf.fit(X_train, y_urgency_train)

    category_clf = LogisticRegression(max_iter=1000, class_weight="balanced")
    category_clf.fit(X_train, y_category_train)

    # --- Evaluation ---
    urgency_preds = urgency_clf.predict(X_test)
    category_preds = category_clf.predict(X_test)

    print("\n=== Urgency Tier Report ===")
    print(classification_report(y_urgency_test, urgency_preds))

    # THE metric that matters most — emergency recall, isolated
    emergency_recall = recall_score(
        y_urgency_test, urgency_preds, labels=["EMERGENCY"], average="micro"
    )
    print(f"\n>>> EMERGENCY RECALL: {emergency_recall:.3f}  (pass bar: >= 0.95) <<<")
    if emergency_recall < 0.95:
        print("!!! FAILS SAFETY BAR — add more/better EMERGENCY examples before proceeding. !!!")

    print("\n=== Symptom Category Report ===")
    print(classification_report(y_category_test, category_preds))

    # --- Save artifacts ---
    import os
    os.makedirs(MODEL_OUT_DIR, exist_ok=True)
    joblib.dump(urgency_clf, f"{MODEL_OUT_DIR}/urgency_clf.joblib")
    joblib.dump(category_clf, f"{MODEL_OUT_DIR}/category_clf.joblib")
    embedder.save(f"{MODEL_OUT_DIR}/embedder")
    print(f"\nSaved model artifacts to {MODEL_OUT_DIR}/")

if __name__ == "__main__":
    main()
```

**Confidence score at inference:** use `predict_proba(X)` on both classifiers and take the max probability as the `confidence` field required by the API contract (Section 9) — e.g. `confidence = float(np.max(urgency_clf.predict_proba(embedding)))`.

### 5.8 Evaluation Requirements
See Section 10 for the full methodology — the headline rule for Track A specifically: **report emergency-case recall separately, and treat it as the pass/fail gate**, not overall accuracy.

### 5.9 Export/Packaging
- Save the trained model artifact (e.g., a pickled scikit-learn pipeline, or a saved Hugging Face model directory) with a clear version tag (e.g., `triage-v0.1.0`).
- Write a short `MODEL_CARD.md` alongside it: what data it was trained on, what languages it supports, known weaknesses, and the evaluation numbers from Section 10.

---

## 6. Track B — Scheme Eligibility & Cost-Matching Model

### 6.1 Objective
Input: a description of the user's situation (symptom category, urgency tier, free-text context like "low income family" or details from an uploaded insurance policy, if that feature exists) plus location.
Output: a ranked list of matching government scheme(s)/insurance clause(s) from a **verified, curated dataset**, each with a confidence score.

**Reminder from Section 4, Rule 4 and 5:** this model matches a query to existing verified entries — it does not invent scheme details, and it does not compute the final cost number.

### 6.2 Why This Is Mostly a Retrieval Problem, Not a "Training" Problem
Government scheme rules (income thresholds, coverage caps, empanelment lists) are discrete facts that change by official notification. A model trained to "predict" these from patterns risks confidently hallucinating wrong numbers — unacceptable for financial guidance to vulnerable users. The correct approach is: **build a clean structured dataset of real scheme facts, then train/use a semantic search (embedding) model whose only job is finding the right entry for a given query.**

### 6.3 The Structured Scheme Dataset (Build This First — It's the Foundation)
This is not an ML dataset in the traditional sense — it's a curated knowledge base. Each entry:

```json
{
  "scheme_id": "string, unique, e.g. 'pmjay_general'",
  "scheme_name": "Ayushman Bharat PM-JAY",
  "type": "government_scheme | private_insurance_template",
  "eligibility_criteria": "plain-language description, e.g. 'bottom 40% economically vulnerable families as per SECC database'",
  "coverage_amount": "e.g. '₹5,00,000 per family per year'",
  "coverage_scope": "e.g. 'secondary and tertiary hospitalization, cashless at empaneled hospitals'",
  "applicable_symptom_categories": ["list of Track A categories this scheme is relevant to, or 'all'"],
  "region": "national | state name",
  "last_verified_date": "YYYY-MM-DD — mandatory, used to flag stale entries",
  "source_reference": "where this fact came from (official portal name/URL, not a guess)"
}
```

Populate this with real entries for: PM-JAY (national), at least one state-specific scheme if available, PMBJP outlet/pricing logic, and AMRIT pharmacy logic. This dataset is reused directly by the platform team's Cost-Aware Routing Engine, so accuracy here matters more than model sophistication. **A starter version of this dataset (6 scheme entries: PM-JAY general, PM-JAY Vay Vandana, PMBJP, AMRIT, a PM-JAY cataract package, and Ayushman Arogya Mandir) is bundled as `10_STARTER_track_b_scheme_dataset.json` — see Section 0.2. Every entry's verification fields are placeholders and must be checked against an official source before real use.**

### 6.4 Query-to-Scheme Matching Pairs (This Is What You Actually Train/Build)
Build example pairs like:

```json
{
  "query_text": "need cataract surgery, family income is low, no insurance",
  "symptom_category": "ophthalmic",
  "correct_scheme_id": "pmjay_cataract_pkg"
}
```

Author several hundred of these covering the range of symptom categories × situations (with insurance, without insurance, different income framings, different regions) your Track A taxonomy produces. **6 starter pairs are included inside `10_STARTER_track_b_scheme_dataset.json` (see Section 0.2) as a pattern to expand from.**

### 6.4a Bootstrap Seed Set — Scheme Dataset + Query Pairs

**Starter scheme dataset (`schemes.json`):**
```json
[
  {
    "scheme_id": "pmjay_general",
    "scheme_name": "Ayushman Bharat PM-JAY",
    "type": "government_scheme",
    "eligibility_criteria": "Bottom 40% economically vulnerable families as per SECC database; no premium payment required",
    "coverage_amount": "₹5,00,000 per family per year",
    "coverage_scope": "Secondary and tertiary hospitalization, cashless and paperless at empaneled hospitals, covers surgeries including cataract and cardiac procedures",
    "applicable_symptom_categories": ["all"],
    "region": "national",
    "last_verified_date": "2026-01-15",
    "source_reference": "myscheme.gov.in/schemes/ab-pmjay"
  },
  {
    "scheme_id": "pmjay_cataract_pkg",
    "scheme_name": "PM-JAY Cataract Surgery Package",
    "type": "government_scheme",
    "eligibility_criteria": "PM-JAY eligible beneficiary requiring cataract surgery",
    "coverage_amount": "Covered under ₹5,00,000 annual family cover, package-rated",
    "coverage_scope": "Cataract surgery at empaneled hospitals, cashless",
    "applicable_symptom_categories": ["ophthalmic"],
    "region": "national",
    "last_verified_date": "2026-01-15",
    "source_reference": "pib.gov.in (PM-JAY package rate list)"
  },
  {
    "scheme_id": "pmbjp_generic_medicine",
    "scheme_name": "Pradhan Mantri Bhartiya Janaushadhi Pariyojana (PMBJP)",
    "type": "government_scheme",
    "eligibility_criteria": "Any citizen; no income restriction",
    "coverage_amount": "Generic medicines priced 60-80% lower than market rate",
    "coverage_scope": "Retail purchase of generic medicines at Janaushadhi Kendra outlets",
    "applicable_symptom_categories": ["all"],
    "region": "national",
    "last_verified_date": "2026-01-15",
    "source_reference": "pib.gov.in PMBJP press release"
  },
  {
    "scheme_id": "amrit_pharmacy",
    "scheme_name": "AMRIT (Affordable Medicines and Reliable Implants for Treatment)",
    "type": "government_scheme",
    "eligibility_criteria": "Any citizen; no income restriction",
    "coverage_amount": "Branded medicines and implants at roughly half of commercial market cost",
    "coverage_scope": "Retail purchase of branded drugs, cardiac and cancer medicines, implants",
    "applicable_symptom_categories": ["all", "cardiovascular", "chronic_ncd"],
    "region": "national",
    "last_verified_date": "2026-01-15",
    "source_reference": "PIB/AMRIT scheme documentation"
  }
]
```

**Starter query-to-scheme pairs (`track_b_queries.json`):**
```json
[
  {"query_text": "need cataract surgery, family income is low, no insurance", "symptom_category": "ophthalmic", "correct_scheme_id": "pmjay_cataract_pkg"},
  {"query_text": "medicine is too expensive at the regular chemist", "symptom_category": "chronic_ncd", "correct_scheme_id": "pmbjp_generic_medicine"},
  {"query_text": "need hospital admission for surgery, cannot afford private hospital", "symptom_category": "other", "correct_scheme_id": "pmjay_general"},
  {"query_text": "heart medicine is costly every month", "symptom_category": "cardiovascular", "correct_scheme_id": "amrit_pharmacy"}
]
```

Expand both files following this pattern before training the retrieval pipeline — treat these as pipeline-testing fixtures, not a sufficient production dataset on their own.

### 6.5 Modeling Approach
- **Embed the structured dataset** (Section 6.3) using a multilingual sentence-embedding model (`sentence-transformers`), turning each scheme's `eligibility_criteria` + `coverage_scope` text into a vector.
- **Embed each incoming query** the same way at inference time.
- **Retrieve top-k matches** by vector similarity (cosine similarity), filtered first by `applicable_symptom_categories` and `region` matching the user's situation, then ranked by similarity score.
- Store vectors in a lightweight, **offline-capable** vector index — `FAISS` is recommended specifically because it can run fully locally, consistent with the product's offline-first requirement for Stage 2.
- Use the query-to-scheme pairs from Section 6.4 as your evaluation set (does the top-1 or top-3 retrieved result match the `correct_scheme_id`?) — and, if you want to go further, as fine-tuning data to adjust the embedding model toward this specific matching task.

### 6.5a Full Runnable Build Script — Track B Retrieval Index (`build_track_b_index.py`)
```python
"""
build_track_b_index.py
Builds the FAISS retrieval index over the structured scheme dataset,
and evaluates it against the query-to-scheme test pairs.
Run: python build_track_b_index.py
"""
import json
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

SCHEMES_PATH = "data/track_b_schemes/schemes.json"
QUERIES_PATH = "data/track_b_schemes/track_b_queries.json"
INDEX_OUT_PATH = "models/scheme-match-v0.1.0/scheme_index.faiss"
EMBED_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"

def scheme_to_text(scheme: dict) -> str:
    return f"{scheme['scheme_name']}. Eligibility: {scheme['eligibility_criteria']}. Coverage: {scheme['coverage_scope']}."

def main():
    with open(SCHEMES_PATH) as f:
        schemes = json.load(f)
    with open(QUERIES_PATH) as f:
        queries = json.load(f)

    embedder = SentenceTransformer(EMBED_MODEL_NAME)

    scheme_texts = [scheme_to_text(s) for s in schemes]
    scheme_ids = [s["scheme_id"] for s in schemes]
    scheme_vectors = embedder.encode(scheme_texts, normalize_embeddings=True)

    dim = scheme_vectors.shape[1]
    index = faiss.IndexFlatIP(dim)  # cosine similarity via inner product on normalized vectors
    index.add(np.array(scheme_vectors, dtype="float32"))

    import os
    os.makedirs(os.path.dirname(INDEX_OUT_PATH), exist_ok=True)
    faiss.write_index(index, INDEX_OUT_PATH)
    with open(INDEX_OUT_PATH + ".ids.json", "w") as f:
        json.dump(scheme_ids, f)
    print(f"Saved FAISS index with {len(scheme_ids)} scheme entries to {INDEX_OUT_PATH}")

    # --- Evaluation: top-1 / top-3 accuracy on query_pairs ---
    top1_hits, top3_hits = 0, 0
    for q in queries:
        q_vec = embedder.encode([q["query_text"]], normalize_embeddings=True)
        scores, idxs = index.search(np.array(q_vec, dtype="float32"), k=3)
        retrieved_ids = [scheme_ids[i] for i in idxs[0]]
        if retrieved_ids[0] == q["correct_scheme_id"]:
            top1_hits += 1
        if q["correct_scheme_id"] in retrieved_ids:
            top3_hits += 1

    n = len(queries)
    print(f"\nTop-1 accuracy: {top1_hits/n:.3f}  (pass bar: >= 0.65)")
    print(f"Top-3 accuracy: {top3_hits/n:.3f}  (pass bar: >= 0.85)")

if __name__ == "__main__":
    main()
```

### 6.6 Evaluation Requirements
- **Top-1 accuracy** and **top-3 accuracy** on the held-out query-to-scheme pairs (top-3 is the more important number — showing 2–3 relevant options to a user is acceptable and often better than forcing a single guess).
- **Staleness check:** confirm your evaluation/reporting flags any `scheme` entry whose `last_verified_date` is older than a reasonable threshold (e.g., 6 months) as needing review — this is a data-quality metric, not a model-accuracy metric, but it's just as important.

### 6.7 Export/Packaging
- Export the scheme dataset (Section 6.3) as a versioned JSON/CSV file — this is a first-class deliverable, not a side artifact.
- Export the trained/selected embedding model and the FAISS index together, versioned (e.g., `scheme-match-v0.1.0`).

### 6.8 Official Government & Public Data Sources (Use These — Do Not Guess or Invent Data)

These are the real, official sources for populating the Track A and Track B datasets. **Using these instead of made-up numbers is what makes this system trustworthy and satisfies Section 4, Rule 4 (never fabricate scheme/pricing data).** For each source: what it's for, where to get it, and exactly how to download it.

#### For Track B (Scheme Eligibility & Cost-Matching) — Sections 6.1–6.7

**1. Ayushman Bharat PM-JAY Health Benefit Packages (HBPs)**
- **What it's for:** The government-fixed prices for medical procedures/treatments. This is what powers the `coverage_amount` and cost fields in your Section 6.3 scheme dataset — it is the single most important source for Track B.
- **Where:** https://pmjay.gov.in
- **How to download:** Go to the site → find the "Resources" or "Health Benefit Packages" section → download the master procedure/package-code/rate list (comes as PDF or Excel). Convert it into the `pricing`/`schemes` JSON schema from Section 6.3 once downloaded.

**2. Socio-Economic Caste Census (SECC) 2011 Database**
- **What it's for:** PM-JAY eligibility rules (who qualifies) are based on this database's deprivation/occupational criteria — needed to fill the `eligibility_criteria` field accurately for PM-JAY-related scheme entries.
- **Where:** https://secc.dord.gov.in (raw data) and https://beneficiary.nha.gov.in (the PM-JAY beneficiary portal, useful for checking how eligibility criteria map to real inputs)
- **How to download:** The SECC portal hosts the raw data parameters directly. For your purposes, you mainly need to read and summarize the *eligibility criteria* (not necessarily download the full raw census), and cross-check the wording against the beneficiary portal.

**3. PMBJP (Jan Aushadhi) Product List & Prices**
- **What it's for:** The fixed subsidized prices for generic medicines — needed for the `pmbjp_generic_medicines` scheme entry and any medicine-cost calculations.
- **Where:** https://www.pmbi.co.in/ProductList.aspx (also available via the "Jan Aushadhi Sugam" mobile app on Android/iOS)
- **How to download:** Visit the product list page → export the full list to PDF (or scrape the table if you're comfortable with basic web scraping — optional, not required).

**4. National List of Essential Medicines (NLEM) 2022**
- **What it's for:** 384 essential medicines across 27 categories with government-capped prices. Use this to sanity-check/cap any medicine-cost figures so the system never overestimates what a medicine should cost.
- **Where:** https://nppa.gov.in/nlem2022 (also mirrored on the CDSCO portal)
- **How to download:** Visit the NPPA site → find the "National List of Essential Medicines 2022" download link → save the PDF.

**5. NHA Hospital Empanelment Module (HEM) & Health Facility Registry (HFR)**
- **What it's for:** The real list of which hospitals are PM-JAY-empaneled, plus the searchable registry of PHCs/CHCs/other public facilities. This is what powers the `facilities` dataset referenced throughout the System Architecture document and the `region`/facility-matching logic.
- **Where:** https://hospitals.pmjay.gov.in (PM-JAY hospital search) and https://nhpr.abdm.gov.in/home (Health Facility Registry under ABDM)
- **How to download:** Use the hospital search portal to look up and verify empaneled facilities for your target pilot district/state (per PRD Section 5.1 — start with one district). The HFR is a searchable centralized database — pull the facilities relevant to your pilot area.

**7. Common Drug Codes for India (SNOMED CT India Drug Extension)**
- **What it's for:** Standardized codes for active ingredients, dose forms, and generic/branded medicine names — useful if you want your Track B matching to be precise about *which* medicine a scheme/pharmacy covers, aligned with India's official Electronic Health Record standards. This is a nice-to-have for a hackathon-stage build, not a blocker.
- **Where:** https://www.nrces.in/services/national-releases
- **How to download:** Register for a free Affiliate License via the Member Licensing & Distribution Service (MLDS) on the NRCeS portal, then download the Terminology Integrated Package or the Flat Files Package.

#### For Track A (Symptom Detection / Triage) — Sections 5.1–5.9

**6. Disease Symptom Prediction Datasets**
- **What it's for:** Foundational, structured symptom-to-condition data to seed your Track A dataset (Section 5.3–5.5) — a base of symptom/category patterns to translate, colloquialize, and re-label against the urgency taxonomy in Section 5.2, exactly as described in Section 5.5, step 1.
- **Where:** https://www.kaggle.com/datasets/itachi9604/disease-symptom-description-dataset or https://www.kaggle.com/datasets/karthikudyawar/disease-symptom-prediction/data
- **How to download:** Create a free Kaggle account → open either dataset URL → click "Download" to get the raw CSV file(s).
- **Important:** these Kaggle datasets are in formal English and are disease-labeled, not urgency-labeled. You must (a) map each disease/symptom row to one of the Section 5.2 symptom categories and one of the three urgency tiers — using the red-flag logic in Section 4 and your own team's clinical heuristic sheet — and (b) rewrite/translate a good portion of the phrasing into colloquial Hinglish/regional-language form per Section 5.5. **Do not use the raw disease names as your model's output — Section 4, Rule 2 forbids the model from outputting a named diagnosis.** Use these datasets only to build the symptom-category and urgency labels, and discard/ignore the disease-name column for anything user-facing.

#### Quick Reference Table

| # | Source | Feeds Into | Format |
|---|---|---|---|
| 1 | PM-JAY Health Benefit Packages | Track B — `coverage_amount`, pricing | PDF/Excel |
| 2 | SECC 2011 / PM-JAY Beneficiary Portal | Track B — `eligibility_criteria` | Web data |
| 3 | PMBJP Product List | Track B — `pmbjp_generic_medicines` entry, medicine pricing | PDF / mobile app |
| 4 | NLEM 2022 | Track B — medicine price sanity-capping | PDF |
| 5 | NHA HEM / HFR | Track B & System Architecture — `facilities` dataset | Web portal search |
| 6 | Kaggle Disease-Symptom Datasets | Track A — base symptom/category patterns (relabel to urgency tiers, never output disease names) | CSV |
| 7 | SNOMED CT India Drug Extension | Track B — standardized drug codes (optional/stretch) | Flat files (registration required) |

---

## 7. Step-by-Step Execution Plan (Follow in Order)

1. **Set up your environment** (Section 8).
2. **Read and internalize Section 4** (non-negotiable rules) — confirm you understand why the AI never finalizes emergencies or invents scheme facts.
3. **Build the structured scheme dataset first** (Section 6.3, using the real official sources in Section 6.8) — this has no ML dependency and unblocks Track B's evaluation later.
4. **Build the Track A labeled dataset** (Section 5.3–5.5, starting from the Kaggle disease-symptom datasets in Section 6.8 as raw material) — aim for your first few hundred examples before writing any training code, so you're not training on a trivially small set.
5. **Build the Track B query-to-scheme pairs** (Section 6.4).
6. **Preprocess and split** both datasets (Section 5.6; equivalent split for Track B).
7. **Train the Track A baseline classifier** (Section 5.7, Approach 1).
8. **Build the Track B retrieval pipeline** (Section 6.5).
9. **Evaluate both** against the metrics and thresholds in Section 10. If Track A's emergency recall doesn't meet the bar, go back to step 4 and add more/better emergency examples before doing anything else — do not proceed to packaging with a failing safety metric.
10. **Wrap both models in the FastAPI service** matching the contract in Section 9.
11. **Run the integration tests** in Section 10.4 against your own service.
12. **Write the evaluation report** (template in Section 11) and the model cards (Section 5.9, 6.7).
13. **(If time allows) Improve Track A with the fine-tuned transformer approach** (Section 5.7, Approach 2) and re-run evaluation.
14. **Package for on-device export** (Section 13) — even if this isn't deployed yet, benchmark it now so Stage 2 isn't a surprise.
15. **Package and hand off** using the checklist in Section 12 and the exact packaging structure in Section 16.

---

## 8. Environment & Tooling Setup

```bash
# Create an isolated environment
python -m venv swasthyasetu-ai-env
source swasthyasetu-ai-env/bin/activate   # (Windows: swasthyasetu-ai-env\Scripts\activate)

# Core ML/data tooling
pip install scikit-learn pandas numpy

# Multilingual embeddings + retrieval
pip install sentence-transformers faiss-cpu

# (Optional, for the fine-tuned transformer upgrade path)
pip install transformers datasets torch

# API service layer
pip install fastapi uvicorn pydantic

# Experiment/version tracking (lightweight option is fine at this stage)
pip install mlflow   # optional — a versioned folder + README log is an acceptable substitute for a hackathon timeline

# On-device export path (for later, Section 13)
pip install onnx onnxruntime
```

Recommended project structure:
```
swasthyasetu-ai-training/
├── data/
│   ├── track_a_symptoms/           # raw + labeled data, versioned
│   └── track_b_schemes/            # structured scheme dataset + query pairs
├── notebooks_or_scripts/
│   ├── train_track_a.py
│   └── build_track_b_index.py
├── models/
│   ├── triage-v0.1.0/
│   └── scheme-match-v0.1.0/
├── evaluation/
│   ├── track_a_eval_report.md
│   └── track_b_eval_report.md
├── api_service/
│   └── main.py                     # the FastAPI service from Section 9
└── MODEL_CARD.md
```

---

## 9. API Service Specification (The Contract the Rest of the Product Depends On)

This is the exact, fixed interface the platform team's Symptom Triage Service and Cost-Aware Routing Engine will call. **Do not change these endpoint paths or response field names without coordinating — the rest of the system is built against this exact shape.**

### 9.1 `POST /predict/triage`
Request:
```json
{ "text": "bahut tez bukhar hai aur saans lene mein takleef ho rahi hai", "language": "hi" }
```
Response:
```json
{
  "symptom_category": "respiratory",
  "suggested_urgency": "EMERGENCY",
  "confidence": 0.91,
  "model_version": "triage-v0.1.0"
}
```

### 9.2 `POST /predict/scheme-match`
Request:
```json
{
  "situation_text": "need cataract surgery, low income family",
  "symptom_category": "ophthalmic",
  "location": { "state": "West Bengal", "district": "Howrah" }
}
```
Response:
```json
{
  "matched_schemes": [
    { "scheme_id": "pmjay_cataract_pkg", "confidence": 0.88 },
    { "scheme_id": "state_scheme_wb_eye", "confidence": 0.61 }
  ],
  "model_version": "scheme-match-v0.1.0"
}
```

### 9.3 Minimal FastAPI Skeleton (Adapt, Don't Just Copy Blindly)
```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class TriageRequest(BaseModel):
    text: str
    language: str

class TriageResponse(BaseModel):
    symptom_category: str
    suggested_urgency: str
    confidence: float
    model_version: str

@app.post("/predict/triage", response_model=TriageResponse)
def predict_triage(req: TriageRequest):
    # load your trained Track A model once at startup, not per-request
    category, urgency, confidence = triage_model.predict(req.text, req.language)
    return TriageResponse(
        symptom_category=category,
        suggested_urgency=urgency,
        confidence=confidence,
        model_version="triage-v0.1.0",
    )

class SchemeMatchRequest(BaseModel):
    situation_text: str
    symptom_category: str
    location: dict

class SchemeMatch(BaseModel):
    scheme_id: str
    confidence: float

class SchemeMatchResponse(BaseModel):
    matched_schemes: list[SchemeMatch]
    model_version: str

@app.post("/predict/scheme-match", response_model=SchemeMatchResponse)
def predict_scheme_match(req: SchemeMatchRequest):
    results = scheme_matcher.query(req.situation_text, req.symptom_category, req.location)
    return SchemeMatchResponse(
        matched_schemes=[SchemeMatch(scheme_id=r.id, confidence=r.score) for r in results],
        model_version="scheme-match-v0.1.0",
    )
```

### 9.4 Required Behavior Rules for the Service
- Never return a `symptom_category` outside the taxonomy in Section 5.2.
- Never return an `urgency_tier`/`suggested_urgency` outside the three fixed values.
- Never return a `scheme_id` that isn't in the curated dataset (Section 6.3) — if nothing matches well, return an empty list, not a guess.
- If internal confidence is below **0.4** (tune this threshold based on your validation data), still return your best guess but with the low confidence score intact — **do not silently withhold the field or crash** — the calling service is responsible for deciding what to do with low confidence, per its own fallback logic (Section 4, Rule 6).
- Always include `model_version` — hardcode it per deployed model, and bump it every time you retrain/redeploy.

---

## 10. Evaluation Methodology (Full Detail)

### 10.1 Track A Metrics & Pass Bar
| Metric | How to compute | Pass bar (hackathon-stage target) |
|---|---|---|
| **Emergency recall** | Of all test examples truly labeled `EMERGENCY`, what fraction did the model predict as `EMERGENCY` (or the rule layer catch via red-flag keywords)? | **≥ 0.95** — this is the single most important number in this entire document |
| Overall urgency-tier accuracy | Standard multi-class accuracy across all three tiers | ≥ 0.75 as a reasonable hackathon-stage target |
| Symptom-category accuracy | Standard multi-class accuracy | ≥ 0.70 |
| Per-language accuracy | Same metrics computed separately for each supported language | Report all languages individually — do not average them into one number that hides a weak language |
| Confidence calibration | Spot-check: do low-confidence predictions correlate with actual errors? | Qualitative check is acceptable at this stage; formal calibration curves are a nice-to-have |

**If emergency recall is below 0.95, this is not a "needs improvement" note — it is a blocker.** Go back to data collection and add more emergency-category examples, review your labels for consistency, and retrain before doing anything else with this track.

### 10.2 Track B Metrics & Pass Bar
| Metric | How to compute | Pass bar |
|---|---|---|
| Top-1 retrieval accuracy | Fraction of test queries where the single best match is the correct `scheme_id` | ≥ 0.65 |
| Top-3 retrieval accuracy | Fraction of test queries where the correct `scheme_id` is in the top 3 results | ≥ 0.85 |
| Dataset staleness | % of scheme entries with `last_verified_date` older than 6 months | Report this number; flag entries for review, does not block model deployment but must be disclosed |

### 10.3 How to Run the Evaluation
1. Never evaluate on data the model saw during training — use only the held-out test split from Section 5.6.
2. Compute metrics per-tier and per-language, not just in aggregate (a single "83% accuracy" number can hide a model that's great at self-care advisories and terrible at emergencies — that's exactly the failure mode this whole document exists to prevent).
3. Write results into the evaluation report (Section 11) before considering the track complete.

### 10.4 Integration Testing (Do This Against Your Own Running API)
- Send at least 10 real requests to your running `/predict/triage` and `/predict/scheme-match` endpoints (not just calling the model function directly in a notebook) and confirm the response shape matches Section 9 exactly.
- Send at least 2 deliberately ambiguous/edge-case inputs (empty string, extremely short text, mixed-language text) and confirm the service returns a valid response rather than crashing.
- Send at least 2 clear emergency-symptom test inputs and manually confirm the response correctly flags `EMERGENCY`.

---

## 11. Evaluation Report Template (Fill This In and Include It in Your Handoff)

```markdown
# Evaluation Report — Track A (Symptom Triage)
Model version: triage-vX.X.X
Dataset version/date: ...
Total examples: train=____, val=____, test=____
Languages covered: ...

## Results
- Emergency recall: ____ (bar: ≥0.95)
- Overall urgency accuracy: ____ (bar: ≥0.75)
- Symptom-category accuracy: ____ (bar: ≥0.70)
- Per-language breakdown: [table]

## Known limitations
- ...

## Recommendation
[Ready for integration / needs more data on X / blocked on Y]

---

# Evaluation Report — Track B (Scheme Matching)
Model/index version: scheme-match-vX.X.X
Scheme dataset size: ____ entries
Query test set size: ____

## Results
- Top-1 accuracy: ____ (bar: ≥0.65)
- Top-3 accuracy: ____ (bar: ≥0.85)
- % stale scheme entries: ____

## Known limitations
- ...

## Recommendation
[Ready for integration / needs more scheme data on X / blocked on Y]
```

---

## 12. Definition of Done — Handoff Acceptance Checklist

- [ ] Track A labeled dataset exists, versioned, with `label_basis` filled in for every row
- [ ] Track B structured scheme dataset exists, versioned, with `source_reference` and `last_verified_date` filled in for every entry
- [ ] Track A model trained and evaluated; **emergency recall ≥ 0.95 confirmed and documented**
- [ ] Track B retrieval pipeline built and evaluated; top-3 accuracy ≥ 0.85 confirmed and documented
- [ ] Per-language results reported separately for Track A, not just averaged
- [ ] FastAPI service running locally, exposing exactly `/predict/triage` and `/predict/scheme-match` matching Section 9's contract
- [ ] Integration tests from Section 10.4 run and passed against the live service
- [ ] Evaluation report (Section 11) completed and included
- [ ] Model cards written for both tracks (what data, what limitations, what version)
- [ ] No hardcoded fake/placeholder scheme data left in the dataset (everything traceable to a real source)
- [ ] No diagnosis, medicine name, dosage, or fabricated cost figure appears anywhere in model output
- [ ] Models exported and a first-pass on-device size/feasibility check done (Section 13) — even a rough number is expected at this stage

If every box above is checked, this workstream is complete and ready to hand back for integration.

---

## 13. On-Device Export Notes (Prepare Now, Deploy Later)

Even though the mobile/on-device phase is a later milestone, do this preparatory step now so it isn't a surprise later:
- Export the Track A model to **ONNX** format and check its file size against the ~100MB total app budget (the model alone should be a small fraction of that, since the app has other content too — a reasonable target for the model artifact itself is under 30–40MB).
- If using the fine-tuned transformer approach (Section 5.7, Approach 2), apply quantization (e.g., int8) as part of the ONNX export to shrink size and speed up inference — document the accuracy trade-off after quantization by re-running the Section 10 evaluation on the quantized model.
- The Track B FAISS index should also be checked for on-device feasibility — FAISS supports lightweight local indexes suitable for mobile-scale datasets (a few thousand scheme entries is well within reach).
- Write down actual numbers (model size in MB, inference latency on a standard laptop as a proxy) — this becomes the starting benchmark for the later on-device integration phase.

---

## 14. Retraining & Maintenance Protocol
- Track flagged/low-confidence predictions and any case where a human reviewer disagreed with the model's output — these are your highest-value future training examples.
- Re-run the full Section 10 evaluation (not a spot check) before replacing any deployed model version.
- Bump `model_version` on every retrain, no exceptions — this is what makes later debugging and audit logging possible.
- Review the Track B scheme dataset's `last_verified_date` fields on a regular cadence (recommend monthly during active development) and update anything stale.

---

## 15. Common Pitfalls & Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Model does well on test accuracy but you're not confident about real-world emergency cases | Test set is too small or not representative — probably too few real EMERGENCY examples | Add more, and specifically more *varied* emergency phrasings (Section 5.5, step 5) |
| Model performs great in English/formal phrasing, poorly on Hinglish/colloquial input | Training data was translated too "cleanly" and doesn't match real user phrasing | Go back to Section 5.4/5.5 and prioritize colloquial, code-mixed examples over clean translations |
| Track B keeps matching irrelevant schemes | Scheme dataset's `eligibility_criteria`/`coverage_scope` text is too short/generic to embed meaningfully | Write richer, more distinctive descriptive text per scheme entry |
| API service crashes on empty or very short input | No input validation | Add explicit handling: very short/empty input → return `CONSULT_SOON` with a low confidence score, never a server error |
| Unsure if a label is EMERGENCY or CONSULT_SOON | Ambiguous case | Per Rule 6 (Section 4), default to the more conservative (more urgent) label when genuinely unsure |
| Not sure which library/model to actually use for embeddings | Too many options | Default to a well-known multilingual `sentence-transformers` model as a safe starting point; don't over-optimize model choice before your dataset is solid — dataset quality matters more than model choice at this stage |

---

## 16. Final Packaging & Handoff to Project Lead (Do This Last)

Once Section 12's checklist is fully checked, package everything into a single folder/zip so the project lead can receive one clean deliverable instead of scattered files. This is the literal, exact structure to produce:

```
SwasthyaSetu_AI_Training_Handoff/
├── README.md                          <- write this last, see template below
├── data/
│   ├── track_a_symptoms_final.json    <- your full, expanded Track A dataset
│   └── track_b_schemes_final.json     <- your full, verified Track B dataset
├── models/
│   ├── triage-v0.1.0/                 <- exported Track A model artifact(s)
│   └── scheme-match-v0.1.0/           <- exported Track B model/index artifact(s)
├── api_service/
│   └── main.py                        <- the FastAPI service from Section 9
├── evaluation/
│   ├── track_a_eval_report.md         <- filled-in template from Section 11
│   └── track_b_eval_report.md         <- filled-in template from Section 11
├── on_device_export/
│   └── benchmark_notes.md             <- the numbers from Section 13
└── model_cards/
    ├── track_a_model_card.md
    └── track_b_model_card.md
```

**README.md template — fill in every blank, do not leave placeholders:**
```markdown
# SwasthyaSetu AI — Training Handoff

## What's in this package
Two trained models (Track A: symptom triage, Track B: scheme/cost matching)
plus a running API service, evaluation reports, and data, as specified in the
AI Training System document.

## Status against Definition of Done (Section 12)
[Paste the checklist from Section 12 here, with every box marked done or, if
not done, clearly marked "NOT DONE — reason: ___"]

## Key results
- Track A emergency recall: ____ (bar: >=0.95)
- Track A overall accuracy: ____
- Track B top-3 accuracy: ____ (bar: >=0.85)

## How to run the API service
1. [exact commands to install dependencies]
2. [exact command to start the service, e.g. `uvicorn api_service.main:app --reload`]
3. [example curl/request to test it]

## Known limitations / what's not finished
[Be honest here — an incomplete item that's clearly flagged is far more useful
to the project lead than a silent gap]

## Data sources used
[List which of the Section 6.8 official sources you actually used, and which
you didn't get to]
```

**How to send it:**
- Zip the whole `SwasthyaSetu_AI_Training_Handoff/` folder, or push it to a shared GitHub repo/branch if the team is using one — either is fine, but the folder structure above must be preserved so the project lead (and the platform team integrating it) can find things without asking.
- Do not send raw, disorganized files individually over chat — the whole point of this structure is that the project lead can open one folder and understand exactly what they're getting, per Section 12.

---

## 17. Summary — What Makes This Document Self-Sufficient

This document intentionally includes, inline, everything an AI assistant or a new teammate would need without consulting any other file:
- Full project context and why the product exists (Section 1)
- What the AI is and isn't allowed to do, and why (Section 4)
- Exact label taxonomies and dataset schemas with real examples (Sections 5, 6)
- Real, official government data sources with exact download instructions (Section 6.8)
- A literal ordered runbook (Section 7)
- Copy-adaptable environment setup and code (Sections 8, 9)
- Numeric pass/fail bars, not vague "good performance" language (Section 10)
- A fill-in report template and a hard acceptance checklist (Sections 11, 12)
- Forward-looking prep for the next phase (Section 13), a troubleshooting guide (Section 15), and an exact final packaging spec (Section 16)

Anyone — human or AI, complete beginner or experienced — reading only this file should be able to go from zero to a working, evaluated, integration-ready pair of models, and know exactly how to package and hand off the result.
