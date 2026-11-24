# Document 17 — Healthcare Cost Research Bibliography

**Reframing note before the list, consistent with `13_FINE_TUNING_TRAINING_PLAN.md`:** these sources are not for fine-tuning a model to "understand" billing structures — that would mean the model approximating costs from learned patterns, which is exactly the risk `15_AI_STRATEGY_UNIFIED.md` §4 keeps out of the Financial Spot. Their real value is different and still substantial: validating and expanding your curated cost database's accuracy (`07_DATA_CATALOG.md`), providing methodology for how official per-procedure costs are actually derived (useful for your `verified_against` provenance fields), and giving you real, citable numbers for the PPT and demo that go beyond the headline OOPE statistics you're already using.

---

## 1. The National Reference Costing Study (most directly useful — start here)

**"Establishing reference costs for the health benefit packages under universal health coverage in India: cost of health services in India (CHSI) protocol"**
- **Authors:** Prinja S, et al. (Department of Health Research, MoHFW, with PGIMER Chandigarh)
- **Why useful:** This is the actual national study whose cost data informed AB-PM-JAY's own package pricing — 52 public and 40 private hospitals across 13 states, using standardized micro-costing. If your curated cost database needs a credible methodology to point to, this is it.
- **Location:** BMJ Open, DOI: `10.1136/bmjopen-2019-035170`
- **How to access:** BMJ Open is fully open-access — search the DOI at `doi.org/10.1136/bmjopen-2019-035170`, or search the title directly on PubMed (pubmed.ncbi.nlm.nih.gov) and follow the free full-text link.

**"The 'Cost of Health Services in India (CHSI)': findings on cost heterogeneity across providers"**
- **Why useful:** Reports actual unit-cost figures per admission by facility tier (tertiary/district/private) — directly comparable to the tier structure your Facility Router already uses.
- **Location:** BMC Health Services Research, DOI: `10.1186/s12913-022-08707-7`
- **How to access:** BMC journals are open-access by default — search the DOI at `doi.org/10.1186/s12913-022-08707-7`, full PDF downloads directly, no login required.

**"Process evaluation of health system costing – Experience from CHSI study in India"**
- **Authors:** Prinja S, Brar S, Singh MP, Rajsekhar K, et al.
- **Why useful:** Documents the practical challenges of collecting real hospital cost data in India — useful context for why your curated dataset should expect real-world data quality gaps, and how the national study itself handled them.
- **Location:** PLOS ONE, indexed in PubMed Central as PMC7219765
- **How to access:** Free full text at `pmc.ncbi.nlm.nih.gov/articles/PMC7219765` — no login, no institutional access needed.

## 2. PM-JAY-Specific Financial Protection Studies

**"Out-of-Pocket Expenditure for Selected Surgeries in the Cardiology Department for AB-PMJAY, Private Health Insurance, and Uninsured Patients in a Tertiary Care Teaching Hospital in Karnataka, India"**
- **Authors:** Kamath S, Singhal N, J J, Brand H, Kamath R (2024)
- **Why useful:** Direct, recent, patient-level comparison — AB-PMJAY patients incurred zero OOPE across all four cardiac surgeries studied, versus meaningful OOPE for privately insured and uninsured patients in the same hospital. This is a strong, specific, citable number for your pitch's "the scheme actually works when correctly matched" argument.
- **Location:** Cureus, DOI: `10.7759/cureus.62444`
- **How to access:** Cureus is fully open-access — `doi.org/10.7759/cureus.62444` links directly to a free PDF.

**"Out-of-Pocket Expenditure (OOPE) Among COVID-19 Patients by Insurance Status in a Quaternary Hospital in Karnataka, India"**
- **Why useful:** Same comparative design applied to COVID-19 hospitalization — reinforces the pattern across a different condition category, useful if you want a second worked example beyond cardiology.
- **Location:** PubMed Central, PMC12386631
- **How to access:** Free full text at `pmc.ncbi.nlm.nih.gov/articles/PMC12386631`.

**"Impact of India's publicly financed health insurance scheme on public sector district hospitals: a health financing perspective"**
- **Why useful:** Uses the CHSI cost data specifically to calculate the *incremental* cost of treating PMJAY patients and the additional revenue PMJAY generates for district hospitals — relevant if you ever want to discuss the scheme's effect on the public-hospital side, not just the patient side.
- **Location:** The Lancet Regional Health – Southeast Asia
- **How to access:** `thelancet.com/journals/lansea/article/PIIS2772-3682(22)00140-8/fulltext` — Lancet Regional Health journals are open-access, no login required.

## 3. Broader OOPE / Catastrophic Health Expenditure Studies

**"Out-of-pocket expenditure and catastrophic health expenditure for hospitalization due to injuries in public sector hospitals in North India"**
- **Authors:** Prinja S, Jagnoor J, Sharma D, Aggarwal S, Katoch S, Lakshmi PVM, Ivers R (2019)
- **Why useful:** Gives a specific, real rupee figure (₹16,768 direct OOPE, per the study) for a condition category outside your current 10-disease dataset (injury-related hospitalization) — a candidate for expanding your curated database's coverage.
- **Location:** PLOS ONE, DOI: `10.1371/journal.pone.0224721`
- **How to access:** Open-access — `doi.org/10.1371/journal.pone.0224721`.

**"Out-of-Pocket Expenditure: A Painful Truth in the Indian Healthcare System"**
- **Authors:** Ghosh M, et al. (2023)
- **Why useful:** A structured overview analysis building on WHO's 2022 global health expenditure statistics — useful as a secondary/framing citation alongside the National Health Accounts figures you're already using, not as a primary data source.
- **Location:** European Journal of Molecular & Clinical Medicine, DOI: `10.53555/ejmcm/2024.11.04.01`
- **How to access:** Available via ResearchGate (`researchgate.net/publication/386253876`) — a free ResearchGate account may be required to download; if unavailable, search the DOI directly, as some aggregators mirror it without a login wall.

## 4. Government Reports (not journal papers, but the primary source underneath all of the above)

- **National Health Accounts (NHA) Estimates for India** — already in `07_DATA_CATALOG.md`; the CHSI studies above are effectively the micro-level data feeding into these macro-level national figures. Published by the National Health Systems Resource Centre (NHSRC), MoHFW — search "National Health Accounts India" on the MoHFW or NHSRC website for the latest edition.
- **AB-PM-JAY Health Benefit Packages Master List** — already in `07_DATA_CATALOG.md`; this is the actual scheme pricing your curated database already draws from — the studies above are useful for validating whether real-world costs at the facility level match these published package rates, which is a legitimate and useful cross-check for your provenance audit trail (`01_AUDIT_KEEP_KILL.md` §1.5).

## How to use this bibliography practically

1. Pick 2–3 of the PM-JAY-specific studies (§2) as citable, specific numbers for your Slide 5 (Impact and Benefits) — a real study finding "zero OOPE for cardiac surgery under PM-JAY vs. meaningful OOPE for uninsured patients in the same hospital" is a stronger, more specific claim than a generic national percentage.
2. Use the CHSI protocol and results papers (§1) if a judge or mentor asks how your curated cost database's numbers were derived — you can point to the actual national methodology your figures are consistent with, rather than just asserting the numbers are correct.
3. Do not use any of these as fine-tuning material — per the reframing note at the top, their job is validating your deterministic data, not training a model to approximate costs.
