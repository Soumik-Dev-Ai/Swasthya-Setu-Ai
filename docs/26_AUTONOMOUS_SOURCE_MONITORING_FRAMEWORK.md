# Document 26 — Autonomous Source Monitoring & Refresh Framework

**Replaces the fixed "quarterly" cadences in `14_RAG_SYSTEM_DESIGN.md`, `16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md`, and `25_FEATURE_UPDATE_INSURANCE_FACILITY_JWT.md` with one unified, autonomous, change-triggered system.** Same underlying pipelines (extraction, mechanical verification, recency resolution) — this document is about *when* they run and *how* changes get detected, not a new verification mechanism.

## The precise target this system is built to hit

Not "perfect" — **autonomous, continuously monitored, and never silently wrong.** Every watched source gets checked on a schedule; every detected change goes through the same verification already built elsewhere in this project; anything that can't be confidently verified doesn't get published and doesn't fail silently either — it keeps serving the last confirmed value and raises a visible flag. That's a stronger, more honest engineering target than "perfect," and it's the one this document actually delivers.

---

## 1. Unified Source Registry

Extends the existing per-domain source lists (`14_RAG_SYSTEM_DESIGN.md` §1, `16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md` §2.1, `25_...md` §4) into one table:

```sql
CREATE TABLE watched_sources (
    id                UUID PRIMARY KEY,
    source_url        VARCHAR(500) NOT NULL,
    source_type       VARCHAR(30) NOT NULL,  -- 'rag_corpus' | 'financial_scheme' | 'facility_registry'
    last_checked_at   TIMESTAMPTZ,
    last_content_hash VARCHAR(64),            -- SHA-256 of fetched content, or ETag/Last-Modified if the source supports it
    check_frequency   INTERVAL DEFAULT '1 day',
    last_change_at    TIMESTAMPTZ,             -- when a real change was last detected (not just checked)
    status            VARCHAR(20) DEFAULT 'active'  -- 'active' | 'needs_manual_confirmation' | 'unreachable'
);
```

Every source already established anywhere in this project — WHO IMCI/ETAT/IMAI, IPHS, ICMR diabetes guidelines, PM-JAY HBP, CGHS rates, the state scheme registry (`21_state_scheme_registry.csv`), NHA HFR queries per city — becomes one row here.

## 2. Change Detector — cheap, frequent, runs before anything expensive

```
Build a lightweight check that runs on a schedule (daily by default, per
source's check_frequency) for every row in watched_sources:

1. Where the source supports HTTP conditional requests (If-Modified-Since /
   ETag), use those — a 304 Not Modified response means no further action,
   at near-zero cost.
2. Where the source doesn't support conditional requests, fetch the content
   and compute a SHA-256 hash. Compare against last_content_hash. No change
   → update last_checked_at only, stop here.
3. If a change IS detected: update last_content_hash, set last_change_at to
   now, and trigger the appropriate full pipeline (Section 3) for that
   source — do NOT do the expensive extraction/verification work as part of
   this check itself, only detection.
4. If a source is unreachable (timeout, 404, robots.txt now disallows it),
   set status = 'unreachable' and continue checking on schedule — don't
   silently drop it from the registry, and don't let one unreachable source
   block checks on any other source.
```

## 3. Autonomous Extraction & Verification — reuses what's already built, triggered by detected change instead of a fixed calendar

No new verification logic here — this step calls the existing pipeline for whichever `source_type` changed:

- `rag_corpus` → the ingestion pipeline from `14_RAG_SYSTEM_DESIGN.md` §2 (clause-level chunking, metadata, re-embed, re-index)
- `financial_scheme` → the ETL pipeline from `16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md` §2.2 (LLM-assisted extraction, mechanical grounding verification, automated recency/supersession resolution)
- `facility_registry` → the acquisition pipeline from `25_FEATURE_UPDATE_INSURANCE_FACILITY_JWT.md` §4 (structured extraction, mechanical verification, staleness-labeled supplementary fields)

**The only thing this document changes about these three pipelines: they now fire automatically when the Change Detector finds something, instead of running unconditionally on a fixed calendar regardless of whether anything actually changed.** This is strictly more responsive (a change is caught within a day of appearing, not up to a quarter later) and cheaper to run (the expensive pipeline only runs when there's real work to do).

## 4. The Non-Silent Fallback — what "never silently wrong" actually means in code

```
For every autonomous pipeline run triggered by Section 3:

1. If verification/resolution succeeds cleanly (per the existing rules in
   each pipeline's own document) → publish the update, log it, done.
2. If verification fails, or recency/supersession resolution is ambiguous
   (the existing needs_manual_confirmation case from
   16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md §2.2) → do NOT publish.
   Set watched_sources.status = 'needs_manual_confirmation' for that source.
   The live table keeps serving whatever it last confirmed — this is not a
   failure state for the user-facing system, it's the fallback working
   correctly.
3. Build a single dashboard or log view listing every source currently in
   needs_manual_confirmation or unreachable status, across all three
   source_types, so anyone on the team can see at a glance what the
   autonomous system couldn't resolve on its own — this is the honest
   visibility layer, not a human-review bottleneck the system waits on.
4. Nothing in this flow requires a human to act before the system continues
   operating normally for every other source — one ambiguous source never
   blocks the rest of the registry.
```

## 5. Scheduling Infrastructure — free-tier compatible

```
Implement Section 2's Change Detector as a scheduled GitHub Actions workflow
(free for this repo, same CI infrastructure already established in
03_SYSTEM_ARCHITECTURE.md §15) running daily:

name: source-monitor
on:
  schedule:
    - cron: '0 3 * * *'  # daily, adjust as needed
jobs:
  check-sources:
    runs-on: ubuntu-latest
    steps:
      - checkout, install deps
      - run the Change Detector script against watched_sources
      - trigger Section 3 pipelines for anything changed
      - fail the workflow run (visibly, in GitHub's UI) if any source enters
        needs_manual_confirmation or unreachable status, so this surfaces
        somewhere you'll actually see it, not just a silent DB flag no one
        checks
```

## 6. What this replaces in the existing documents

| Document | Old cadence | New behavior |
|---|---|---|
| `14_RAG_SYSTEM_DESIGN.md` §1 corpus sources | Manual re-ingestion whenever someone remembers | Change-detected, autonomous, daily-checked |
| `16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md` §2.2 | Fixed quarterly acquisition | Change-detected, autonomous, daily-checked |
| `25_FEATURE_UPDATE_INSURANCE_FACILITY_JWT.md` §4 | One-time run per city on request | Change-detected, autonomous, daily-checked, per city already added to the registry |

The verification standards in all three documents are unchanged — this document is purely about triggering them correctly and continuously instead of on a fixed calendar or by someone remembering to run a script.
