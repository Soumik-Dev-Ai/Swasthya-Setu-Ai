# Prompt: Generate SwasthyaSetu AI's SIH 2026 Idea-Submission PPT Content

*Paste everything below into a fresh AI session (or reuse in this one) to get slide-by-slide, paste-ready content for the official SIH 2026 template.*

---

## SYSTEM ROLE

You are a Smart India Hackathon 2026 pitch-deck writer who has read hundreds of winning and losing SIH idea submissions. You know that SIH evaluators skim in under 30 seconds per slide, penalize text-walls and template deviations, and reward specific numbers over vague claims. You write tight, visual-first slide content — never paragraphs, never marketing fluff, never a claim the team can't actually back up if a judge asks a follow-up question.

## HARD SIH 2026 COMPLIANCE RULES — NON-NEGOTIABLE

1. **Exactly 6 slides, including the title slide. No more, no fewer.** Submissions that exceed this risk being ignored or disqualified.
2. **Fixed slide order and section headers — do not rename, reorder, merge, or split them:**
   1. Title Slide
   2. Proposed Solution (Idea Title + Detailed Explanation)
   3. Technical Approach
   4. Feasibility and Viability
   5. Impact and Benefits
   6. Research and References
3. **Use the official AICTE/SIH-provided PowerPoint template file** — download it from your institution's SPOC or the SIH portal. Do not design a new template, change the provided fonts, or alter the branded layout. Your job (and this prompt's job) is to produce the *content* that gets typed into that template, not a replacement design.
4. **Final submission must be a PDF.** No .pptx, .doc, or any other format is accepted on the portal — convert only after content and design are both final.
5. **No paragraphs.** Bullet points, short phrases, diagrams, and infographics only. Aim for 4–6 bullets per slide, each bullet under ~15 words wherever possible.
6. **Slide 1 must contain exactly:** Problem Statement ID, Problem Statement Title (verbatim from the official PS document — do not paraphrase it), Theme name, PS Category (Software/Hardware), Organization/Ministry that owns the PS, Team ID, and Registered Team Name (exactly as registered on the SIH portal — not a nickname).
7. **Confirm your college's actual internal-round deadline with your SPOC before finalizing** — this is set per-institution and is not the same as the national SIH portal deadline; do not assume a date.
8. Every claim on every slide must be something the team can defend live if a judge asks "show me" — do not describe an unbuilt feature in present tense as if it already works.

## PROJECT CONTEXT PACK (use this, don't invent facts beyond it)

**Problem Statement:** SIH26133 — *Accessibility and quality of public healthcare services, particularly in rural and underserved areas* — Government of Maharashtra (Maharashtra State Innovation Society) — Theme: MedTech / BioTech / HealthTech — Category: Software.

**Project name:** SwasthyaSetu AI — an offline-first, multilingual healthcare navigation and affordability platform for rural India, built on top of India's existing public health hierarchy (Sub-Centre → PHC → CHC → District Hospital), not around it.

**Supporting statistics (use exactly these, cite the source type in Slide 6):**
- Out-of-Pocket Expenditure (OOPE) is 39.4% of India's total health spending (National Health Accounts estimates), of which 42% comes from retail pharmacy purchases alone.
- CHC specialist vacancy: 51.6%. PHC doctor vacancy: 18.8% (MoHFW Rural Health Statistics).
- 70–77% of rural primary care is delivered by informal, non-degree providers (NDAPs) due to this staffing gap.
- India has roughly 1 million ASHA workers, most still using paper-based reporting.
- PM-JAY has issued over ₹114 crore in penalties across 2,842 hospitals for billing irregularities — the "accountability" gap this PS explicitly names.

**Already-built features (describe these as built, present tense):**
- Deterministic 41-keyword safety gate across English/Hindi/Bengali — cannot be overridden or downgraded by AI output, by design.
- 3-stage AI triage cascade (Gemini → Groq → NVIDIA NIM) with graceful degradation to "uncertain," never a crash, if all providers fail.
- OOPE/cost calculator against a curated 10-disease benchmark dataset.
- 8-scheme eligibility matcher (PM-JAY, CGHS, ESIC, JSY, PMNDP, HMDG, Chiranjeevi, WBHS) — fully deterministic, no AI in the money-decision path.
- Tiered facility routing across 16+ hospitals (Sub-Centre/PHC/CHC/District), offline-capable via a client-side dataset mirror.
- ASHA offline field-capture with idempotent sync (zero duplicate records across reconnect cycles).
- 9-language interface with native-script rendering.
- Free-tier-only stack: React/Vite frontend, FastAPI/Python backend, PostgreSQL (Neon.tech)/SQLite, Vercel + Render hosting.

**In-development features for this PS specifically (describe these as "in development" or "planned for [demo date]" — NOT as already working):**
- Longitudinal patient record + timeline across referral tiers.
- Referral tracking (Sub-Centre → PHC → CHC → District Hospital) with completion-rate visibility.
- High-risk (maternal/child/chronic) follow-up worklist for ASHA workers.
- Facility/district-level dashboard for health administrators.
- Diagnostic/medicine-availability snapshot (explicitly periodic, not live — say this out loud, don't imply a live feed).
- FHIR-India-shaped data export for future standards interoperability (explicitly not a live ABDM integration — the team does not have, and is not seeking, government API access).

**Honest differentiation claim (use this framing, not a broader one):** SwasthyaSetu AI is not claiming no rural health digitization exists — platforms like eSanjeevani, CHIP (Rajasthan), and Sakhi (Bihar/Assam) are real precedents. The specific, defensible claim is that no existing platform combines a *deterministic, AI-proof safety override* with an *integrated affordability/scheme-matching engine* in one offline-first package.

**On the deliberate exclusion of live teleconsultation:** the PS lists "assisted teleconsultation" as one optional component among several. The team's architecture is deliberately async and offline-first by design, specifically because rural connectivity can't support reliable live video — state this as a considered engineering tradeoff on Slide 3 or Slide 4, not something to avoid mentioning.

## YOUR TASK

Write the complete slide-by-slide content for all 6 slides, ready to paste directly into the official template placeholders. For each slide, output:
- The exact bullet text (not a summary of what the bullets should say — the actual final bullet text)
- A one-line note on what visual/diagram belongs on that slide (e.g., "3-box flow diagram: Symptom Input → Safety Gate → Routing + Cost")
- Anything from the Context Pack above that must NOT be omitted from that slide

Slide-specific guidance:
- **Slide 1 (Title):** Use the exact PS ID/Title/Theme/Category/Organization from the Context Pack above. Leave `[TEAM ID]` and `[REGISTERED TEAM NAME]` as placeholders for the team to fill in themselves.
- **Slide 2 (Proposed Solution):** One-sentence elevator pitch first, then 4–5 bullets covering what the solution does and how it addresses SIH26133 specifically (access, continuity, quality, accountability — use those exact words at least once, they're the PS's own framing). Close with the honest differentiation claim, not the broad one.
- **Slide 3 (Technical Approach):** Tech stack as a compact list (not paragraph), plus the flow-diagram note, plus one line on the deterministic-safety-gate mechanism since it's the single most demo-able technical fact this team has.
- **Slide 4 (Feasibility and Viability):** Split explicitly into what's already built vs. what's in development for this PS, using the two lists in the Context Pack — don't blur them into one undifferentiated feature list. Name at least 2 real risks (free-tier hosting limits, facility-dataset coverage) and their mitigations, briefly.
- **Slide 5 (Impact and Benefits):** Ground this in the persona/stat pairing — pick the single strongest statistic and tie it to a concrete outcome (e.g., referral completion visibility reduces the "lost between tiers" problem the PS names directly).
- **Slide 6 (Research and References):** List data sources by name only (PM-JAY HBP, MoHFW Rural Health Statistics, National Health Accounts, NHA Health Facility Registry, Kaggle Symptom-Disease dataset, AI4Bharat) — no live links needed on the slide itself, just enough for a judge to verify independently.

## OUTPUT FORMAT

Return the 6 slides in order, each as its own clearly labeled section, using this shape:

```
### SLIDE [n] — [Section Name]
**Bullets:**
- ...
**Visual:** [one line]
**Must include from context pack:** [one line]
```

Do not add a 7th slide, a table of contents, or an appendix — the official template and portal will reject anything beyond the 6 required slides.
