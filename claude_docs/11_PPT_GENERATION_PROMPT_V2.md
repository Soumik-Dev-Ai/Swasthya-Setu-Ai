# Prompt (v2 — Zero-Context, Data-Visual Edition): Generate SwasthyaSetu AI's SIH 2026 PPT

*This version assumes the AI agent you paste it into has **no prior knowledge of this project whatsoever**. Every fact it needs is embedded below. Paste the entire document as one message.*

*Supersedes the earlier, shorter prompt (`10_PPT_GENERATION_PROMPT.md`) — use this one; that one assumed shared conversation context this one doesn't need.*

---

## SYSTEM ROLE

You are a Smart India Hackathon (SIH) pitch-deck specialist and data-visualization designer. You have reviewed hundreds of SIH idea submissions and know exactly what separates a shortlisted deck from a rejected one: **evaluators skim, they don't read.** A slide with three sourced numbers and one chart beats a slide with five well-written sentences, every time. Your job is to produce content that is simultaneously rigorous (every claim traceable to a real source) and visual (every slide built around at least one chart, table, diagram, or annotated graphic, never a wall of bullets). You never invent a statistic. If you don't have a verified number for something, you say so explicitly and leave a clearly marked placeholder rather than a confident-sounding guess — a fabricated number discovered by a judge is worse than an honest gap.

## PART 1 — HARD SIH 2026 COMPLIANCE RULES (violating any of these risks disqualification)

1. **Exactly 6 slides total, including the title slide.** No appendix, no 7th "thank you" slide, no table of contents.
2. **Fixed section order, do not rename or reorder:**
   1. Title Slide
   2. Proposed Solution (Idea Title + Detailed Explanation)
   3. Technical Approach
   4. Feasibility and Viability
   5. Impact and Benefits
   6. Research and References
3. **Use the official AICTE/SIH 2026 PowerPoint template file**, downloaded from the team's institution SPOC or the SIH portal — do not design a new template, change the provided font family, or alter the branded layout/color scheme. This prompt produces *content and visual specifications to place inside that template*, not a replacement design system.
4. **Final submission is a PDF.** No .pptx, .doc, or image file is accepted by the portal.
5. **No paragraphs anywhere.** Bullet points, short phrases, and labeled visuals only. Target 4–6 bullets per slide, each bullet under ~15 words.
6. **Slide 1 must contain, verbatim:** Problem Statement ID, Problem Statement Title (exact wording, do not paraphrase), Theme, PS Category, Organization/Ministry, Team ID, Registered Team Name.
7. **Confirm the actual internal-round submission deadline with the team's SPOC before finalizing** — this varies by institution and is separate from the national SIH portal deadline; do not assume a specific date.
8. **Every claim must be defensible live.** Anything not yet built must be labeled "in development," never described in present tense as already working.

## PART 2 — FULL PROJECT CONTEXT (self-contained — do not assume any prior knowledge)

### 2.1 The Problem Statement
- **ID:** SIH26133
- **Title (verbatim):** "Accessibility and quality of public healthcare services, particularly in rural and underserved areas"
- **Theme:** MedTech / BioTech / HealthTech
- **Category:** Software
- **Sponsoring organization:** Government of Maharashtra (Maharashtra State Innovation Society)
- **What it actually asks for:** rural and underserved communities face long travel distances, specialist shortages, irregular diagnostics, fragmented medical records, delayed referrals, and low awareness of services. Patients move between Sub-Centres, PHCs, rural hospitals, and district hospitals with no continuity of information. The brief explicitly asks teams to improve **access, continuity, quality, and accountability** of the *existing public health system* — not to build a private-pay bypass around it.

### 2.2 The Project — SwasthyaSetu AI
An offline-first, multilingual healthcare navigation and affordability platform for rural India, layered on top of the existing public health hierarchy (Sub-Centre → PHC → CHC → District Hospital).

### 2.3 Verified statistics — use these, cite the source category, never alter the numbers
| Statistic | Value | Source category |
|---|---|---|
| Out-of-Pocket Expenditure (OOPE) as % of total health spending | 39.4% | National Health Accounts (NHA) Estimates for India, most recent published edition |
| OOPE trend | Down from 69.4% (2004-05) and 62.6% (2014-15) to 39.4% | Same NHA series — shows real but incomplete progress |
| Share of OOPE from retail pharmacy purchases alone | 42% | NHA Estimates |
| PHC doctor vacancy rate | 18.8% | MoHFW Rural Health Statistics |
| CHC specialist vacancy rate | 51.6% | MoHFW Rural Health Statistics |
| Rural primary care delivered by informal/non-degree providers (NDAPs) | 70–77% | Cross-referenced field research on rural health workforce gaps |
| Number of ASHA (Accredited Social Health Activist) workers nationally | ~1,000,000 | National Health Mission published figures |
| PM-JAY penalties for hospital billing irregularities | ₹114 crore levied across 2,842 hospitals | Ayushman Bharat PM-JAY published enforcement data |

**Do not add any additional statistic to this table unless the team supplies a verified source for it. Do not round, dramatize, or extrapolate beyond what's stated here.**

### 2.4 What is already built (describe in present tense — it exists and works)
- Deterministic safety-gate: a hardcoded 41-keyword red-flag scanner across English, Hindi, and Bengali. Its defining rule: an AI model's output can **never** downgrade or override a red flag the deterministic scanner already caught — this is enforced in code, not policy.
- 3-stage AI triage cascade for image analysis: Gemini 1.5 Flash → Groq Llama-3.2-90B-Vision → NVIDIA NIM Llama-3.1-70B-Instruct, 15-second timeout per stage, degrading gracefully to an explicit "uncertain" result (never a crash) if all three fail.
- OOPE/cost calculator referencing a curated dataset covering 10 disease/procedure categories.
- Scheme-eligibility matcher covering 8 government schemes (PM-JAY, CGHS, ESIC, JSY, PMNDP, HMDG, Chiranjeevi, WBHS) — fully rule-based, no AI involved in this decision path.
- Tiered facility-routing engine across 16+ seeded hospitals/facilities (Sub-Centre/PHC/CHC/District tiers), functional fully offline via a client-side dataset mirror.
- ASHA field-worker offline data capture with idempotent sync — verified zero duplicate records across repeated offline/online reconnect cycles in testing.
- 9-language interface with native-script rendering (not transliteration).
- Entirely free-tier infrastructure: React 19 + Vite + Tailwind CSS frontend; FastAPI (Python 3.12) backend; PostgreSQL (Neon.tech free tier) in production, SQLite in development; hosted on Vercel (frontend) + Render (backend), zero paid services anywhere in the stack.
- Target technical performance bars (these are the team's own engineering targets, present them as targets/benchmarks, not yet-measured claims unless the team confirms they've been formally measured): emergency-case recall ≥ 0.95, overall triage tier accuracy ≥ 0.75, safety-gate response time < 200ms with zero network dependency, full online triage response < 3 seconds (95th percentile), application footprint under 100MB, functional on 2GB RAM Android devices.

### 2.5 What is explicitly in development for this specific problem statement (describe as "in development" or "planned" — never as already working)
- Longitudinal patient record with a visit/referral timeline spanning multiple facility tiers.
- Referral tracking (Sub-Centre → PHC → CHC → District Hospital) with a computable referral-completion rate.
- A follow-up worklist flagging overdue high-risk (maternal, child, chronic-condition) patients for ASHA outreach.
- A facility/district-level dashboard for health administrators (triage volume, referral completion, follow-up backlog).
- A diagnostic-capacity/medicine-availability snapshot per facility — explicitly a periodic, manually/semi-regularly updated snapshot, never described as a live real-time feed.
- A FHIR-India-shaped data export for future standards interoperability — explicitly **not** a live ABDM integration; the team has no government API access and is not seeking any for this build.

### 2.6 Honest differentiation claim — use exactly this framing
Do **not** claim no rural health digitization solution exists. Real precedents exist and should be named: eSanjeevani (national teleconsultation platform), CHIP (Rajasthan's ASHA digitization initiative), and Sakhi (Bihar/Assam's AMRIT-linked health-worker platform). The specific, defensible claim is narrower: **no existing platform combines a deterministic, AI-proof safety override with an integrated affordability/scheme-matching engine inside one offline-first package.** This is the sentence to use, or a close paraphrase of it — not a broader "nobody has built this" claim, which will not survive a judge who knows the space.

### 2.7 The deliberate exclusion of live video teleconsultation
The PS brief lists "assisted teleconsultation" as one optional component among several ("a solution that may combine..."). This project's architecture is deliberately asynchronous and offline-first, specifically because reliable live video is not something rural connectivity can guarantee. State this as a considered engineering tradeoff, not an omission — this needs to appear somewhere in Slide 3 or Slide 4, explicitly.

### 2.8 Real-life scenario for illustrative use on Slide 5 (Impact and Benefits)
Use a short, named scenario to make the impact concrete — but follow the placeholder rule strictly:

> **Illustrative scenario — Meena, a farm laborer in a rural district:** Meena develops symptoms that would normally mean either ignoring them (informal-provider bias toward the nearest, not necessarily right, option) or an expensive, possibly unnecessary trip to a private facility. Using the app, she gets an urgency classification in her own language in under 3 seconds, a routing recommendation to the correct tier of facility for her case, and a cost estimate that reflects her actual PM-JAY eligibility — **[INSERT TEAM'S VERIFIED FIGURE FROM THEIR CURATED DATASET]** at a private facility versus an estimated ₹0 out-of-pocket at a PM-JAY-empaneled public facility for an eligible procedure.

**Anti-fabrication rule for this scenario:** the bracketed placeholder above must be filled with a real number pulled from the team's own curated 10-disease cost dataset before this ships. If the team cannot supply one before the deadline, remove the specific rupee figure and keep the scenario qualitative ("a significant cost difference") rather than inventing a number.

### 2.9 Data sources to name on Slide 6 (name only — no live links required on the slide)
PM-JAY Health Benefit Packages Master Dataset · National Health Accounts (NHA) Estimates for India · MoHFW Rural Health Statistics · Ayushman Bharat PM-JAY Annual Reports · NHA Health Facility Registry (public directory) · Kaggle Symptom-Disease Prediction Dataset · AI4Bharat (IndicBERT/IndicTrans2) multilingual NLP resources.

## PART 3 — VISUAL / DATA-BALANCE REQUIREMENTS

This is a hard design constraint, not a suggestion: **every slide except the title slide must contain at least one chart, table, or annotated diagram, and visual elements should occupy roughly half the slide's usable space.** Text and visuals are co-equal, not visual-as-decoration-for-text. For every visual, specify: chart/diagram type, exact data plotted (from Part 2 only), axis/label text, and a one-line caption a judge could read in isolation and still understand the point.

## PART 4 — PER-SLIDE INSTRUCTIONS

### Slide 1 — Title
- Content: PS ID, PS Title (verbatim), Theme, Category, Organization, Team ID `[PLACEHOLDER]`, Registered Team Name `[PLACEHOLDER]`, institution name/logo.
- Visual: institution logo + a small icon row representing the solution's 3 pillars (Triage / Routing / Affordability) — no chart needed here, this slide is branding-first.

### Slide 2 — Proposed Solution
- Bullets: one-sentence elevator pitch, then 4 bullets covering what it does and how it addresses "access, continuity, quality, and accountability" (use those exact 4 words at least once — they're the PS's own framing), then the Part 2.6 differentiation sentence.
- Visual: a horizontal flow diagram — **Symptom Input (voice/text/photo, 9 languages) → Deterministic Safety Gate → AI Cascade (if no red flag) → Routing + Cost Output.** Label each box; this is the single most important diagram in the deck.

### Slide 3 — Technical Approach
- Bullets: tech stack as a compact tagged list (Frontend / Backend / Database / AI / Hosting, one line each), the deterministic-safety-gate mechanism explained in one sentence, and the teleconsultation-exclusion rationale from Part 2.7.
- Visual: a simple architecture diagram (client → API → safety gate → 3-stage AI cascade with the 15s-per-stage timeout labeled → database) OR a sequence diagram of the cascade specifically. Include the exact provider names and timeout value — specific numbers here read as more credible than a generic "AI-powered" box.

### Slide 4 — Feasibility and Viability
- Bullets: explicitly split into "Already built" (Part 2.4, condensed to 3 bullets) and "In development for this PS" (Part 2.5, condensed to 3 bullets) — do not blend these into one undifferentiated list.
- Visual A: a simple built-vs-in-development progress indicator (e.g., a horizontal bar or checklist-style graphic, not prose) showing the split at a glance.
- Visual B: a compact comparison table — SwasthyaSetu AI vs. eSanjeevani vs. CHIP/Sakhi — across 4 columns (Works offline? / Has a safety override? / Has a cost/affordability engine? / Multilingual?) — this is where the differentiation claim becomes visually obvious instead of just asserted in text.

### Slide 5 — Impact and Benefits
- Bullets: 3–4 bullets tying a specific statistic from Part 2.3 to a specific outcome (e.g., referral tracking directly addresses the "patients lost between tiers" problem the PS names).
- Visual A: a bar chart comparing PHC doctor vacancy (18.8%) vs. CHC specialist vacancy (51.6%) — two bars, labeled, sourced.
- Visual B: a donut/pie chart showing OOPE composition — 42% retail pharmacy vs. 58% other categories of the 39.4% total OOPE figure.
- Visual C: the Meena scenario from Part 2.8, presented as a small labeled callout box beside the charts, not as another paragraph of running text.

### Slide 6 — Research and References
- Content: the source list from Part 2.9, presented as a compact table (Source name | What it provided) rather than a bare bullet list — a table reads as more rigorous and fits the "balance visuals with text" requirement even on the most text-heavy slide by nature.

## PART 5 — OUTPUT FORMAT

Return all 6 slides, each in this exact shape:

```
### SLIDE [n] — [Section Name]
**Bullets:**
- ...
**Visual 1:** [chart/diagram/table type] — [exact data plotted, from Part 2 only] — [axis/labels] — [one-line caption]
**Visual 2 (if applicable):** ...
**Text-to-visual balance check:** [confirm roughly 50/50 space allocation]
**Placeholders remaining to fill before submission:** [list any `[PLACEHOLDER]` or `[INSERT...]` markers still present]
```

Do not add a 7th slide. Do not fabricate a statistic that isn't in Part 2.3. Do not present an "in development" feature (Part 2.5) as already working. If asked to make the deck feel "more impressive," add a real chart or a more precise citation — never a bigger number.
