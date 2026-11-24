# Document 7 — Data Sources & Dataset Catalog

All sources below are freely accessible without login, application, or institutional approval. Where a portal requires an account for bulk export but shows the same data openly in browse mode, that's noted explicitly rather than glossed over.

## 1. Government Open Data Sources

| Dataset | Source URL | License | Format | Records | Key fields | Freshness | Consuming module |
|---|---|---|---|---|---|---|---|
| PM-JAY Health Benefit Packages (HBP) Master List | pmjay.gov.in (HBP section) | Open Government Data (OGDL) | PDF / portal tables | ~1,900+ procedure packages | Package name, package rate, specialty, tier | Updated periodically by NHA, not real-time | Cost Analyzer (curated DISEASES DB seed) |
| Ayushman Bharat PM-JAY Annual Reports | pmjay.gov.in (reports section) | OGDL | PDF | N/A (narrative + tables) | Beneficiary counts, empanelment stats, fraud/penalty figures | Annual | Research backing / pitch statistics |
| PMBJP (Jan Aushadhi) Generic Medicine Price List | pmbi.co.in | OGDL | PDF / portal table | 2,000+ generics | Drug name, MRP, PMBJP price, pack size | Updated periodically | Cost Analyzer, FR-12 medicine-visibility snapshot |
| NLEM 2022 (National List of Essential Medicines) | nppa.gov.in | OGDL | PDF | 384 drugs | Drug name, category, ceiling price | Static (2022 edition) | Cost Analyzer cross-reference |
| NHA Health Facility Registry (HFR) public directory | hfr.abdm.gov.in / nhpr.abdm.gov.in (public search, no registration needed for browse) | OGDL | Portal search / CSV export where available | Varies by state, tens of thousands of facilities nationally | Facility name, type, address, geo-coordinates, registration status | Rolling, facility-registration-driven | Facility Router seed data expansion (addresses Audit #1: 16-hospital sparsity) |
| data.gov.in — Rural Health Statistics | data.gov.in | OGDL | CSV/XLS | State/district-level tables | PHC/CHC vacancy rates, facility counts | Annual MoHFW publication | PRD research backing, dashboard baseline context |
| SECC 2011 (Socio-Economic Caste Census, published aggregates) | secc.gov.in | OGDL | PDF/CSV (published aggregate tables only — individual-level data is restricted, so this project uses only the public aggregate tables) | State/district aggregates | Poverty-linked eligibility indicators | Static (2011, still the statutory basis for several scheme eligibility rules) | Scheme Matcher eligibility logic reference |
| IRDAI ROHINI (Registry of Hospitals in Network of Insurance) | irdai.gov.in / rohini.irdai.gov.in (public search) | OGDL | Portal search | Nationwide insurance-network hospitals | Hospital ID, name, network status | Rolling | Facility Router (private-insurance-route matching) |
| CGHS (Central Government Health Scheme) rate lists | cghs.nic.in | OGDL | PDF | State/city-wise procedure rates for CGHS-empaneled facilities | Procedure name, CGHS rate, facility category | Revised periodically by CGHS | Cost Analyzer, via the government-only ETL pipeline (`16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md`) |

**Government-only scope note (added per `16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md`):** the Cost Analyzer and Scheme Matcher draw exclusively from an allow-list of official government sources — PM-JAY, CGHS, NHA HFR, and the state portals for your existing 8 schemes. This is enforced as an allow-list, not a denylist of excluded private sources, and it's refreshed on a quarterly cadence through the mechanically-verified ETL pipeline in that document, not a live query-time lookup to any external site.

## 2. Medical Knowledge Bases

| Source | URL | License | Use |
|---|---|---|---|
| WHO IMCI (Integrated Management of Childhood Illness) Guidelines | who.int (open publications) | WHO open-access publication terms (attribution required, no redistribution restriction for non-commercial educational use — cite, don't republish verbatim per copyright discipline) | Ground-truth severity/urgency labeling rubric for triage relabeling (`06_AI_MODEL_SPEC.md` §3) |
| WHO Emergency Triage Assessment and Treatment (ETAT) guidelines | who.int | Same as above | Red-flag keyword corpus clinical grounding |
| SNOMED CT India Extension | nrces.in (National Resource Centre for EHR Standards) — free registration for the India National Release, no institutional approval, individual sign-up | SNOMED CT India National Release License (free for use within India) | Standardized clinical-category terminology for triage labels — **not** used for dosage/prescription output, per the hard restriction in `04_AI_SAFETY_ETHICS.md` |

## 3. ML Datasets (Kaggle / HuggingFace — direct slugs)

| Dataset | Platform | Slug/URL | License | Format | Records |
|---|---|---|---|---|---|
| Disease Symptom Prediction | Kaggle | `kaggle.com/datasets/itachi9604/disease-symptom-description-dataset` | CC0 / open (verify current license tag on the dataset page before use) | CSV | ~4,900 rows, 41 diseases, symptom columns |
| Symptom-to-Diagnosis dataset | Kaggle | `kaggle.com/datasets/paultimothymooney/medical-speech-transcription-and-intent` (or equivalent symptom-text dataset — confirm exact slug during Sprint 0) | Varies — confirm license per dataset before use | CSV/audio | Varies |
| IndicTrans2 | HuggingFace | `huggingface.co/ai4bharat/indictrans2-en-indic-1B` | MIT | Model weights | N/A (translation model, not a labeled dataset) |
| IndicBERT | HuggingFace | `huggingface.co/ai4bharat/IndicBERTv2-MLM-only` | MIT | Model weights | N/A |
| IndicVoices | AI4Bharat (huggingface.co/ai4bharat) | Search "IndicVoices" on the AI4Bharat HuggingFace org page | CC-BY-4.0 (verify per release) | Audio + transcripts | Multi-language speech corpus |

**Note on dataset drift risk:** Kaggle dataset slugs and license tags occasionally change owners or get taken down — pin the exact dataset version/download date in your repo's `07_DATA_CATALOG.md` copy on the day you actually download it, don't rely on this document's URLs remaining valid indefinitely.

## 4. Geo-Spatial Data

| Dataset | Source | License | Use |
|---|---|---|---|
| OpenStreetMap tiles | openstreetmap.org (via Pigeon Maps) | ODbL (Open Database License) — attribution required, already satisfied by standard OSM tile attribution shown in the map component | Facility map rendering (already in use, zero billing) |
| India district boundaries | Survey of India / data.gov.in open GIS layers, or the community-maintained `datameet/maps` GitHub repository (public, MIT-licensed India administrative boundary shapefiles) | Open / MIT (per source) | District-level dashboard aggregation boundaries (FR-13) |

## 5. Data Refresh Strategy

| Dataset | Static or dynamic | Refresh cadence |
|---|---|---|
| Curated disease cost DB (10 diseases) | Static, manually curated | Re-verify against PM-JAY HBP list once per hackathon cycle; no live refresh |
| Facility dataset (16 → expanded via HFR) | Semi-static | Batch-refresh from HFR public search before each demo/milestone, not live-polled |
| Scheme eligibility rules (8 schemes) | Static | Re-verify against official scheme pages once per cycle — eligibility rules change with government budget cycles |
| `facility_capacity_snapshot` (FR-12) | Explicitly non-live snapshot | Manual/periodic update, timestamp always shown — this is a design choice, not a limitation to hide |
| Client-side offline dataset mirror | Versioned (Audit #13) | Bumped whenever any of the above changes; device checks version opportunistically on next successful network call |
