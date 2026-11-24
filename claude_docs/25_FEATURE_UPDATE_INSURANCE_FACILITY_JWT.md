# Document 25 — Feature Update: JWT Hardening, Scheme Portal Links, Facility Direction Mapping

## 0. Two corrections applied before this prompt, stated once

1. **Insurance/scheme eligibility stays deterministic — no live web scraping at request time.** This request's actual goal (correct, specific eligibility results) is already achieved by the existing rule-based Scheme Matcher. What's new here is a `registration_portal_url` field, populated through the same verified, human-checked-once ETL pipeline as every other piece of scheme data (`16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md`), never scraped fresh per click.
2. **Facility data for Kolkata expansion uses the same governed-source pattern as the state scheme registry — NHA's Health Facility Registry, not ad-hoc scraping.** This is routing data; getting it wrong has higher real-world stakes than the financial data this same correction was already applied to.

Everything below is buildable within these corrections — nothing in the original request's actual *goals* gets dropped, only the "scrape it live" mechanism.

---

## 1. JWT Hardening — confirm and complete

This was already specified (`03_SYSTEM_ARCHITECTURE.md` §7-8, `01_AUDIT_KEEP_KILL.md` #9) — treat this request as confirming it's genuinely implemented, not a stub:

```
Confirm/complete real JWT authentication:
1. Password hashing via BCrypt (passlib) — never plaintext, never a fake/
   dummy check.
2. JWT issuance on successful login: HS256, signed with JWT_SECRET, 24h
   expiry, actual claims (user id, role) — not a hardcoded or mock token.
3. Confirm the refresh-token endpoint from audit item #9 exists and works:
   separate JWT_REFRESH_SECRET, refresh flow that doesn't require
   re-entering credentials.
4. Add a test that specifically attempts login with wrong credentials and
   confirms rejection, and a test that decodes a real issued token and
   confirms its claims match the logged-in user — this is what proves it's
   real rather than cosmetic.
Report which of these were already correct vs. needed fixing.
```

## 2. Scheme Registration Portal Links — data model + UI

**Data model addition** (to the schemes table, via the same ETL/provenance pattern as everything else in `16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md`):

```sql
ALTER TABLE schemes ADD COLUMN registration_portal_url VARCHAR(500);
ALTER TABLE schemes ADD COLUMN enrollment_method VARCHAR(30);
  -- 'self_service_portal' | 'facility_based' | 'csc_based' | 'unknown'
```

**Why `enrollment_method` matters:** not every government scheme has a clean self-service "apply here" URL the way a private insurance product would. PM-JAY enrollment, for instance, typically runs through empanelled hospitals or Common Service Centres, not a standalone signup flow — verify this per scheme rather than assume a portal URL exists for all of them. A broken or misleading "Apply" button is worse than an honest "Apply through your nearest empanelled hospital or CSC" message.

```
Add registration_portal_url and enrollment_method to the schemes table.
Populate both through the existing government ETL pipeline
(16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md) — verify each scheme's
actual enrollment mechanism from its official source before populating
either field. Do not populate registration_portal_url with a guessed or
unverified URL; if a scheme's real enrollment path is facility-based rather
than a self-service portal, set enrollment_method accordingly and leave
registration_portal_url null.

Frontend: the "Apply" button on the scheme result card
(05_FRONTEND_SPEC.md /cost or /schemes flow) checks enrollment_method:
- self_service_portal + URL present → button links directly to
  registration_portal_url (new tab)
- facility_based / csc_based / unknown → button shows the appropriate
  guidance text instead of a link, sourced from enrollment_method, not a
  generic fallback
```

## 3. Facility Direction Mapping — zero scraping needed, uses existing data

```
Add a "Get Directions" button to the facility popup/card in the facility
search results (05_FRONTEND_SPEC.md /facilities page and MapView component).

1. Construct the link as a static URL, no API call, no API key needed:
   https://www.google.com/maps/dir/?api=1&destination={lat},{lng}
   using the facility's existing latitude/longitude
   (03_SYSTEM_ARCHITECTURE.md §6.1 hospitals table — already populated,
   no new data needed).
2. This opens Google Maps (app or web) with directions pre-filled — it does
   NOT use the Google Maps Platform API and does not incur any billing, so
   it doesn't conflict with the existing Pigeon Maps/OSM choice for in-app
   map rendering (03_SYSTEM_ARCHITECTURE.md tech stack).
3. Button placement: in the facility detail popup, alongside the existing
   facility info (tier, PM-JAY empanelment status, etc.) — visually
   consistent with the existing glassmorphism component style
   (05_FRONTEND_SPEC.md §1).
4. Works offline for facility lookup (existing behavior unchanged) — the
   direction link itself obviously requires connectivity to actually open
   Google Maps, but constructing and displaying the button doesn't.
```

## 4. Facility Coverage Expansion — governed scraping, repeatable for any city

**Schema addition for the supplementary fields:**
```sql
ALTER TABLE hospitals ADD COLUMN phone VARCHAR(20);
ALTER TABLE hospitals ADD COLUMN services_offered JSONB;
ALTER TABLE hospitals ADD COLUMN operating_hours JSONB;
ALTER TABLE hospitals ADD COLUMN hours_snapshot_taken_at TIMESTAMPTZ;
  -- mirrors facility_capacity_snapshot's existing "as of" pattern (02_PRD.md FR-12)
```

```
Build this as a repeatable, parameterized capability — "expand facility
coverage for [city/area]" — not a one-off script hardcoded to a single city.
First run target: Kolkata.

PRIMARY SOURCE (structured facility identity — name, tier, address,
coordinates, PM-JAY empanelment): NHA's Health Facility Registry
(07_DATA_CATALOG.md), same as before. This remains the authoritative source
for anything routing-relevant.

SUPPLEMENTARY SOURCES (richer details — phone number, operating hours,
services offered): the facility's own official website where findable, or
other official/verifiable directories. This is genuinely additional
scraping beyond the primary source, and it's fine to do — the rule isn't
"don't scrape," it's "don't publish an unverified scraped detail as fact."

For every field, regardless of source:
1. Structured identity fields (name, address, coordinates, tier, PM-JAY
   status) go through the same mechanical verification as before — trace
   back to source, flag ambiguous/incomplete records for manual
   confirmation rather than auto-publishing.
2. Time-sensitive supplementary fields (hours, "currently open" status,
   bed/service availability) get the SAME non-live treatment already
   established for facility_capacity_snapshot (02_PRD.md FR-12): store with
   an explicit snapshot timestamp, and the frontend must show "as of [date]"
   next to any such field — never presented as live, because a periodic
   scrape genuinely isn't.
3. Static supplementary fields (phone number, services offered, address)
   can be stored without a staleness label but still need the same source
   traceability check as structured identity fields — a phone number
   scraped from a defunct or wrong page is still a wrong phone number.
4. If a supplementary detail can't be verified against its claimed source,
   omit it rather than publish an unconfirmed guess — same "abstain, don't
   guess" discipline as everywhere else in this project.

Report per city run: facilities added, fields populated per facility,
anything flagged for manual confirmation, and confirm existing facility
routing tests still pass with the expanded dataset.
```

## Consolidated: give all four sections above to Claude Code as one task, in this order (1 → 2 → 3 → 4), since 3 has zero dependencies and can run anytime, while 2 and 4 both depend on the ETL/acquisition governance already established and should follow that pattern exactly, not a new one invented for this update.
