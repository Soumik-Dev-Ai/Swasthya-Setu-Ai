# Master Phase Execution Prompts — SwasthyaSetu AI (Schema-Calibrated)

> **Calibration Notice:** All 8 schema sketch bugs (from runtime verification) have been corrected across the prompts below:
> 1. **1F:** `SafetyOverrideLog` uses `{override_type, text_signal, vision_signal, triggered_keywords, symptoms_hash}` with SHA-256 digest privacy (no raw text stored).
> 2. **2A:** `Facility` fallback uses `{district, state, pm_jay_empaneled, lat, lng, type}` and synthesizes the hospital-dict shape.
> 3. **2C:** SQL `Scheme` free-text `coverage_rules` are merged honestly without fabricating match percentages.
> 4. **3B:** Triage `age` UI index (0/1/2) is mapped to string (`"child" | "adult" | "senior"`) preventing 422 unprocessable entity errors; no unmodeled `duration`/`severity` sent to JSON.
> 5. **4B:** Referral statuses use the real state machine: `pending` → `in_transit` → `arrived` → `completed` / `lost`.
> 6. **4E:** `CapacityCreate` uses `{facility_id, diagnostic_capacity, medicine_stock, source}` matching `schemas/care.py`.
> 7. **5B:** `AshaRecord` LWW compares `created_at` (table has no `updated_at`).
> 8. **4D:** `syncBatch` extracts numeric `worker_id` from the JWT `sub` claim.

---

# Prompt 1 of 7 — Phase 1: Critical Backend Bugs

```markdown
## ROLE & OPERATING MODE: SENIOR BACKEND ENGINEER (MONITOR PERSONA)

You are an expert backend engineer operating under strict **MONITOR PERSONA** and **PONYTAIL PERSONA** (lazy senior dev) guidelines:
1. **Zero Scope Creep:** You will execute ONLY the 8 tasks designated (1A through 1H). Do not refactor untouched files, do not add helper utilities, do not introduce extra wrappers or architectural layers.
2. **Context-First Verification:** Before editing any file, inspect the target lines to confirm the current state matches the provided excerpts.
3. **Privacy & Schema Accuracy:** Follow the established privacy discipline (SHA-256 digest only, never store raw patient symptoms). Use the exact database models from `app.models`.
4. **Targeted Workspace:** Backend root is `c:\Users\user\projects\SwasthaSetu Ai\backend`. Do NOT edit any frontend files.

---

### BACKGROUND & CONTEXT
A formal line-by-line audit against documentation specs (`docs/00`–`27`) identified 8 critical runtime defects in the backend:
- Unconditional DuckDuckGo scraping in `precision_service.py` adds ~3.5s latency and crashes on network failures.
- Financial ETL cascade in `etl_financial.py` only tries the first LLM provider and immediately drops the document on failure instead of trying the rest of the cascade.
- `VisionSignalOut` schema in `schemas/v2.py` omits grounding verification fields, causing FastAPI's response serializer to drop them.
- `v2_data.py` contains named medical diagnoses and drug dosages (e.g., "Aspirin 325 mg chewed"), violating medical safety guardrails (Doc 04 §2).
- `source_monitor.py` defaults to `_raise_unreachable`, has an empty `_PIPELINES` registry, and `watched_sources` has 0 rows.
- `v3_intent.py` runs `enforce_safety()` but fails to write override events to the `safety_override_log` table.
- `.github/workflows/ci.yml` attempts to `cd frontend` (directory renamed to `frontend 2.0`).
- `requirements.txt` is missing `sentence-transformers>=2.2.0`.

---

### TASKS TO EXECUTE

#### 1A. Gate `precision_service.py` Behind `ENABLE_WEB_SCRAPE` & Add Timeout Protection
- **Target File:** `backend/app/services/precision_service.py`
- **Current State:**
  ```python
  async def apply_precision(query: str) -> dict:
      osint_query = f"site:nih.gov OR site:who.int OR site:mayoclinic.org {query}"
      sources = await get_verified_sources(osint_query)
      return {
          "verified_sources": sources,
          "disclaimer": DISCLAIMER_TEXT
      }
  ```
- **Action:**
  1. Import `settings` from `app.core.config`.
  2. At the top of `apply_precision(query: str)`, add:
     ```python
     if not settings.ENABLE_WEB_SCRAPE:
         return {"verified_sources": [], "disclaimer": DISCLAIMER_TEXT}
     ```
  3. In `get_verified_sources()`, wrap `DDGS().text(...)` inside a `try/except Exception` block with a 3.0-second timeout guard so network hiccups return an empty list gracefully without throwing an uncaught 500.
  4. Ensure `ENABLE_WEB_SCRAPE=True` is set in `backend/.env` (without leading/trailing spaces).

#### 1B. Fix Financial ETL Cascade Provider Loop
- **Target File:** `backend/app/services/etl_financial.py` (around lines 105–135)
- **Current Defect:**
  ```python
  cascade = _get_extraction_cascade()
  provider = cascade[0] if cascade else None
  if provider is None:
      return None
  env_key, model = provider
  # ... calls litellm, catches exception and returns None immediately
  ```
- **Action:**
  Replace the single-provider call with a loop over all available cascade providers:
  ```python
  cascade = _get_extraction_cascade()
  if not cascade:
      return None

  for env_key, model in cascade:
      api_key = getattr(settings, env_key, None)
      if not api_key:
          continue
      try:
          import litellm
          response = await asyncio.wait_for(
              litellm.acompletion(
                  model=model,
                  api_key=api_key,
                  messages=[{"role": "user", "content": _EXTRACT_PROMPT + source_text[:12000]}],
                  temperature=0.0,
                  max_tokens=800,
              ),
              timeout=180.0,
          )
          raw = (response.choices[0].message.content or "").strip()
          rows = _parse_extracted_rows(raw)
          if rows:
              return rows
          logger.warning("[Cascade] %s produced empty/unparseable extraction. Trying next.", model)
      except Exception as exc:
          logger.warning("[Cascade] %s failed during financial extraction: %s. Trying next.", model, exc)
          continue

  return None
  ```

#### 1C. Expose Grounding Fields in `VisionSignalOut` Schema
- **Target File:** `backend/app/schemas/v2.py` (lines 186–195)
- **Current State:**
  ```python
  class VisionSignalOut(BaseModel):
      visual_symptom_category: str
      visual_urgency_signal: str
      confidence: int
      model_version: str
      source: str
  ```
- **Action:** Add the missing fields:
  ```python
  class VisionSignalOut(BaseModel):
      visual_symptom_category: str
      visual_urgency_signal: str
      confidence: int
      model_version: str
      source: str
      grounding_reference: str | None = None
      grounding_verified: bool = False
      reason: str = ""
  ```

#### 1D. Sanitize Named Diagnoses & Medication Dosages in `v2_data.py`
- **Target File:** `backend/app/services/v2_data.py` (lines 154–172)
- **Problem:** Violates AI Ethics Guardrail Doc 04 §2 by returning named diagnoses and dosages.
- **Action:** In the `CONDITIONS` list:
  1. Replace `"Dengue fever"` with `"Possible vector-borne febrile illness"`
  2. Replace `"Typhoid fever"` with `"Prolonged febrile illness with GI symptoms"`
  3. Replace `"Acute coronary event"` / `"Cardiac chest pain"` with `"Possible cardiac emergency"`
  4. Replace `"Aspirin 325 mg chewed (if not allergic) and rush to an emergency facility..."` with `"Rush to nearest emergency facility with cardiac capability immediately. Do not drive yourself."`
  5. Replace `"Symptomatic care: paracetamol, fluids, rest. Antivirals help only if started in the first 48 hours."` with `"Stay hydrated, rest, and monitor temperature. Consult a medical officer if fever persists past 48 hours."`

#### 1E. Wire `source_monitor.py` Fetcher & Pipeline Callbacks
- **Target Files:**
  - `backend/app/services/source_monitor.py` (lines 35–65)
  - `backend/scripts/source_monitor_run.py`
- **Action:**
  1. In `source_monitor.py`, update `check_one()`: change default `fetcher` from `lambda url: _raise_unreachable(url)` to the actual `fetch_content` function.
  2. Register minimal operational callbacks in `_PIPELINES`:
     ```python
     _PIPELINES = {
         "rag_corpus": lambda db, content, source: asyncio.sleep(0),
         "financial_scheme": lambda db, content, source: asyncio.sleep(0),
         "facility_registry": lambda db, content, source: asyncio.sleep(0),
     }
     ```
  3. In `backend/scripts/source_monitor_run.py`, ensure `fetcher=fetch_content` is passed to `check_one()`.

#### 1F. Log Safety Overrides in `v3_intent.py` (Exact Schema & Privacy Pattern)
- **Target File:** `backend/app/api/routers/v3_intent.py` (around lines 55–85)
- **Schema & Privacy Requirement:**
  The real model is `app.models.safety_override.SafetyOverrideLog` with columns:
  - `override_type: str` (e.g. `"deterministic_red_flag"`)
  - `text_signal: str` (`"red_flag"`)
  - `vision_signal: str | None` (`None`)
  - `triggered_keywords: list[str]`
  - `symptoms_hash: str` (SHA-256 digest of input text — **NO raw symptom text stored**)
- **Action:**
  1. Inject `db: AsyncSession = Depends(get_db)` into the `route_intent` endpoint in `v3_intent.py`.
  2. In the `if verdict.emergency:` block, log the override following the privacy pattern from `v2_engine.py`:
     ```python
     import hashlib
     from app.models.safety_override import SafetyOverrideLog

     try:
         digest = hashlib.sha256(payload.text.encode("utf-8")).hexdigest()[:64]
         db.add(SafetyOverrideLog(
             override_type="deterministic_red_flag",
             text_signal="red_flag",
             vision_signal=None,
             triggered_keywords=list(verdict.triggered_keywords),
             symptoms_hash=digest,
         ))
         await db.flush()
     except Exception as exc:
         logger.warning("Safety override logging failed in v3_intent: %s", exc)
     ```

#### 1G. Fix Frontend Directory Path in GitHub Actions CI
- **Target File:** `.github/workflows/ci.yml` (lines 55–63)
- **Action:**
  Replace `cd frontend` with `cd "frontend 2.0"` in all build/lint steps.

#### 1H. Add `sentence-transformers` to Backend Requirements
- **Target File:** `backend/requirements.txt`
- **Action:** Append `sentence-transformers>=2.2.0` to the file.

---

### DETERMINISTIC VERIFICATION CRITERIA
Execute the following verification command:
```powershell
cd "c:\Users\user\projects\SwasthaSetu Ai\backend"
python -c "from app.main import app; from app.schemas.v2 import VisionSignalOut; v = VisionSignalOut(visual_symptom_category='rash', visual_urgency_signal='urgent', confidence=80, model_version='test', source='who', grounding_reference='c1', grounding_verified=True, reason='observed'); print('BACKEND COMPILES & SCHEMA VERIFIED OK')"
```
If this succeeds, output a succinct bulleted change list and STOP. Do not proceed to Phase 2.
```

---

# Prompt 2 of 7 — Phase 2: Hybrid Data Strategy (In-Memory First → DB/RAG Fallback)

```markdown
## ROLE & OPERATING MODE: SENIOR BACKEND ENGINEER (MONITOR PERSONA)

You are an expert backend engineer operating under strict **MONITOR PERSONA** and **PONYTAIL PERSONA** guidelines:
1. **Zero Scope Creep:** Execute ONLY the 3 tasks (2A, 2B, 2C).
2. **Architecture Mandate:** Implement the user's explicit hybrid strategy:
   - Fast-path: query in-memory `v2_data.py` first.
   - Fallback-path: if not found in memory (or user requests expanded results), query the persistent SQL database.
   - Respect real database schemas: `Facility` has `district`, `state`, `pm_jay_empaneled`, `type`, `lat`, `lng` (it does NOT have `city_id` or `er24`).
   - Do NOT invent fake match percentages for SQL schemes with free-text coverage rules.
3. **Target Workspace:** `backend/app/services/v2_engine.py` and `backend/app/api/routers/v2_engine.py`.

---

### BACKGROUND & CONTEXT
The current codebase has an architectural split-brain:
- `facility_acquisition.py` scrapes Pan-India hospitals and saves them into the SQL `facilities` table (`name`, `type`, `pm_jay_empaneled`, `lat`, `lng`, `district`, `state`, `last_verified_date`). But `v2_engine.py:267-302` only reads from the 16 hardcoded hospitals in `v2_data.HOSPITALS`. Searching for cities outside the 16 returns 0 results.
- `etl_financial.py` extracts verified procedure rates into the SQL `government_costs` table. But `v2_engine.py:113-155` estimates costs solely from `v2_data.DISEASES` (10 items), and `POST /api/cost/alternatives` never calls `lookup_as_of()`, so `as_of` date is always `null` in the UI.
- Scheme matching in `v2_engine.py:168-264` only checks the 8 hardcoded schemes in `v2_data.SCHEMES`. SQL `schemes` table rows have free-text `coverage_rules` and `eligibility_notes`.

---

### TASKS TO EXECUTE

#### 2A. Facilities: In-Memory First → SQL `Facility` Table Fallback (Real Schema)
- **Files:**
  - `backend/app/services/v2_engine.py` (`search_facilities`)
  - `backend/app/api/routers/v2_engine.py` (`/facilities/search` and `/meta/cities`)
- **Schema Reference (`Facility` model):**
  Columns: `id: int`, `name: str`, `type: str` (SC/PHC/CHC/PM-JAY_Hospital/PMBJP_Pharmacy), `pm_jay_empaneled: bool`, `lat: float`, `lng: float`, `district: str`, `state: str`, `last_verified_date: datetime | None`, `phone: str | None`.
- **Action:**
  1. Update `search_facilities` in `v2_engine.py` to accept `db: AsyncSession | None = None`.
  2. First, collect matching rows from `v2_data.HOSPITALS` matching `city_id` and filters.
  3. If in-memory results are empty (city is not in the 16 curated hospitals):
     - Resolve the city's district and state: `city = D.city_by_id(city_id)`.
     - Query SQL `Facility` table matching on `district` or `state`:
       ```python
       from app.models.facility import Facility
       from sqlalchemy import select, or_

       stmt = select(Facility).where(
           or_(
               Facility.district.ilike(f"%{city['name']}%"),
               Facility.state.ilike(f"%{city['name']}%"),
           )
       )
       if filters.get("pmjay"):
           stmt = stmt.where(Facility.pm_jay_empaneled == True)
       if query.strip():
           stmt = stmt.where(Facility.name.ilike(f"%{query.strip()}%"))

       result = await db.execute(stmt)
       sql_rows = result.scalars().all()
       ```
     - Synthesize the hospital-dict shape expected by the frontend:
       ```python
       for fac in sql_rows:
           km = D.haversine(city["lat"], city["lon"], fac.lat, fac.lng)
           h_dict = {
               "id": f"sql-{fac.id}",
               "name": fac.name,
               "cityId": city_id,
               "lat": fac.lat,
               "lon": fac.lng,
               "pmjay": fac.pm_jay_empaneled,
               "er24": fac.type in ("CHC", "PM-JAY_Hospital"),
               "icu": fac.type == "PM-JAY_Hospital",
               "bloodBank": fac.type == "PM-JAY_Hospital",
               "nabh": False,
               "beds": 100 if fac.type == "PM-JAY_Hospital" else 30,
               "priceIndex": 1.0,
               "score": 85,
               "phone": fac.phone,
           }
           rows.append({
               "hospital": h_dict,
               "km": km,
               "directions_url": f"https://www.google.com/maps/dir/?api=1&destination={fac.lat},{fac.lng}",
               "last_verified_date": fac.last_verified_date.isoformat() if fac.last_verified_date else None,
           })
       ```
  4. In `GET /api/meta/cities`:
     - Query distinct `district` from `Facility` where `district != ''`.
     - Synthesize city entries for districts not already present in `v2_data.CITIES` and merge them so Pan-India districts appear in the city search dropdown.

#### 2B. Cost Estimation: In-Memory First → `GovernmentCost` Fallback + Attach `as_of`
- **Files:**
  - `backend/app/services/v2_engine.py` (`estimate_cost`, `best_matches`)
  - `backend/app/api/routers/v2_engine.py` (`/cost/estimate`, `/cost/alternatives`)
- **Action:**
  1. In `v2_engine.py`:
     - If `disease_id` is found in `v2_data.DISEASES`, use the curated base cost.
     - If `disease_id` is NOT in `v2_data.DISEASES`, query `GovernmentCost` table:
       `db.scalar(select(GovernmentCost).where(GovernmentCost.procedure_key == disease_id).order_by(GovernmentCost.effective_date.desc()).limit(1))`
       and use `row.amount_inr` as the base cost.
  2. In `backend/app/api/routers/v2_engine.py`:
     - Ensure `pricing_service.lookup_as_of(db, disease_id)` is called for BOTH `POST /api/cost/estimate` AND `POST /api/cost/alternatives`.
     - Return the resolved `as_of` ISO timestamp on every cost alternative item so the frontend never displays `"Data as of —"`.

#### 2C. Scheme Matching: Merge Portal URLs & Real Details Honestly
- **File:** `backend/app/services/v2_engine.py` (`match_schemes`)
- **Schema Reference (`Scheme` model):**
  Columns: `id: int`, `name: str`, `coverage_rules: str` (free text), `eligibility_notes: str` (free text), `registration_portal_url: str | None`, `enrollment_method: str`.
- **Action:**
  1. Keep existing in-memory `v2_data.SCHEMES` evaluation as primary (evaluates rule lambdas with honest match percentage).
  2. Query SQL `Scheme` table for all rows.
  3. For schemes matched from in-memory, if a matching SQL row exists by name/ID, enrich it with `registration_portal_url` and `enrollment_method` from the database.
  4. For SQL schemes not in `v2_data.SCHEMES`, append them with their real `coverage_rules` and `eligibility_notes`. Do NOT invent or fabricate fake match percentages—set `pct: 50` or flag as `"general_eligibility"` with honest notes.

---

### DETERMINISTIC VERIFICATION CRITERIA
Run:
```powershell
cd "c:\Users\user\projects\SwasthaSetu Ai\backend"
python -c "from app.services.v2_engine import search_facilities, estimate_cost, match_schemes; print('PHASE 2 HYBRID ROUTING SYNTAX OK')"
```
Output a succinct summary of modifications and STOP. Do not proceed to Phase 3.
```

---

# Prompt 3 of 7 — Phase 3: Triage Result Rendering & Form Bug Fixes

```markdown
## ROLE & OPERATING MODE: SENIOR FRONTEND DESIGN ENGINEER (MONITOR PERSONA)

You are an expert React/TypeScript UI engineer adhering to the **MONITOR PERSONA**, **PONYTAIL PERSONA**, and the **Web-Designer Skill**:
1. **Zero Scope Creep:** Modify ONLY `frontend 2.0/src/pages/Triage.tsx` and the corresponding types/payloads in `frontend 2.0/src/lib/api.ts`.
2. **Schema & Type Accuracy:**
   - `TriageAnalyzeRequest` on the backend expects `age: str | None = None`. In `Triage.tsx`, `age` state is index `0 | 1 | 2` (`0`: child, `1`: adult, `2`: senior). **You MUST map this number to a string (`"child" | "adult" | "senior"`)** before sending, or FastAPI will reject it with a 422 error!
   - Do NOT send `duration` or `severity` to the backend JSON body because they do not exist on `TriageAnalyzeRequest`.
3. **Design Standards:** Framer Motion staggered reveals (`SPRING_SOFT`), glassmorphism card styling (`bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl`), `oklch` color system (coral for emergency, mint for verified, sky for sources), clean typography (Space Grotesk + Satoshi), 44px touch targets. No unstyled elements, no AI slop.
4. **Target Workspace:** `frontend 2.0/src/pages/Triage.tsx` and `frontend 2.0/src/lib/api.ts`.

---

### BACKGROUND & CONTEXT
The Triage page currently drops critical data and has serious state bugs:
- **Bug 1 (Dropped AI Output):** The backend computes vision analysis (`vision_signal`), medical reasoning (`reasoning`), condition matches with probabilities (`matched`), safe clinical advice (`advice`), and verified citations (`verified_sources`). However, `Triage.tsx:122-158` only reads `result.level` and renders a generic i18n string (`t("tr.a" + level)`). All rich AI outputs are ignored in the JSX.
- **Bug 2 (Image Removal):** In `Triage.tsx:239`, clicking the image remove `X` calls `setImage(null)` but forgets `setImageFile(null)`. `analyze()` checks `if (imageFile)` and continues uploading the deleted image.
- **Bug 3 (Age State Mapping):** In `Triage.tsx`, `age` is a numeric index `0`, `1`, `2`. Sending it as a number causes a 422 error on the backend. It must be mapped to `"child" | "adult" | "senior"`.

---

### TASKS TO EXECUTE

#### 3A. Fix Image Deletion State
- **File:** `frontend 2.0/src/pages/Triage.tsx` (around line 239)
- **Current Defect:**
  ```tsx
  onClick={(e) => { e.stopPropagation(); setImage(null); }}
  ```
- **Action:** Update the handler to clear both states and reset the file input:
  ```tsx
  onClick={(e) => {
    e.stopPropagation();
    setImage(null);
    setImageFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }}
  ```

#### 3B. Pass Mapped `age` String to API (Prevent 422)
- **Files:**
  - `frontend 2.0/src/lib/api.ts` (lines 377–390)
  - `frontend 2.0/src/pages/Triage.tsx` (lines 56–72)
- **Action:**
  1. In `api.ts`, update `analyzeTriage` and `analyzeTriageText`:
     ```ts
     export const analyzeTriage = (symptoms: string, flags: string[], image?: File, age?: string) => {
       const fd = new FormData();
       fd.append("symptoms", symptoms);
       fd.append("flags", JSON.stringify(flags));
       if (age) fd.append("age", age);
       if (image) fd.append("image", image);
       return upload<TriageResult>("/triage/analyze", fd);
     };

     export const analyzeTriageText = (symptoms: string, flags: string[], reasoning = true, age?: string) =>
       post<TriageResult>("/triage/analyze", { symptoms, flags, reasoning, age: age || undefined });
     ```
  2. In `Triage.tsx:56-72`:
     - Map `age` index to string:
       ```ts
       const ageStr = age !== null ? (["child", "adult", "senior"][age] ?? undefined) : undefined;
       ```
     - Pass `ageStr` to `analyzeTriage` / `analyzeTriageText`.

#### 3C. Implement Complete Triage Result Card
- **File:** `frontend 2.0/src/pages/Triage.tsx` (replace lines 122–158)
- **Action:** Render the full clinical triage card with staggered animations:
  1. **Level Header:**
     - Level 4: `PulseBadge` with `"EMERGENCY"` label, pulsating red glow, and immediate `<a href="tel:108">` call button.
     - Levels 1–3: Badges for Routine, Prompt, or Urgent.
  2. **Matched Conditions Pills (stagger delay 0.15s):**
     - Iterate over `result.matched ?? []`.
     - Render condition cards with condition name and confidence score badge.
  3. **Clinical Advice Card (stagger delay 0.3s):**
     - Render `result.advice` in an elevated glassmorphic card.
  4. **Vision Analysis Section (stagger delay 0.45s, conditional on `result.vision_signal`):**
     - Display uploaded image thumbnail side-by-side with detected findings:
       - Category (`visual_symptom_category`)
       - Urgency signal (`visual_urgency_signal`)
       - Confidence percentage
       - Grounding verification badge (Green check if `grounding_verified`, with cited reference).
  5. **Reasoning Engine Finding (stagger delay 0.6s, conditional on `result.reasoning`):**
     - Display category finding, clinical explanation text, and cited chunk ID.
  6. **Verified Sources List (stagger delay 0.75s, conditional on `result.verified_sources`):**
     - Render clinical literature references (WHO IMCI, IPHS, etc.).
  7. **Bottom Actions & Mandatory Static Disclaimer:**
     - Buttons: `Find Facilities` (`/app/facilities`), `Call 108` (if level >= 3), `Retake`.
     - Static, non-animated disclaimer: `"⚠️ AI decision support only. Not a medical diagnosis. In emergency, call 108 immediately."`

---

### DETERMINISTIC VERIFICATION CRITERIA
Run:
```powershell
cd "c:\Users\user\projects\SwasthaSetu Ai\frontend 2.0"
npx tsc --noEmit
```
Ensure zero TypeScript compilation errors. Output a succinct change summary and STOP.
```

---

# Prompt 4 of 7 — Phase 4: Wire All 17 Unused API Functions Into UI

```markdown
## ROLE & OPERATING MODE: SENIOR FULLSTACK UI ENGINEER (MONITOR PERSONA)

You are an expert engineer operating under **MONITOR PERSONA**, **PONYTAIL PERSONA**, and the **Web-Designer Skill**:
1. **Zero Scope Creep:** Wire the 17 orphaned functions from `frontend 2.0/src/lib/api.ts` into their corresponding UI modules. Inline sub-components cleanly within their respective page files.
2. **Schema & State Machine Accuracy:**
   - **Referral Statuses:** The backend state machine ONLY accepts: `pending` → `in_transit` → `arrived` → `completed` / `lost`. Do NOT send `CREATED`, `ACCEPTED`, or `CANCELLED`.
   - **Capacity Snapshot:** `CapacityCreate` accepts `{facility_id, diagnostic_capacity: dict, medicine_stock: dict, source: str}`. Do NOT send `{status: "OPEN"}`.
   - **Offline Sync:** `syncBatch` takes `worker_id: int`. Extract it from the JWT `sub` claim.
3. **Target Workspace:**
   - `frontend 2.0/src/pages/Asha.tsx`
   - `frontend 2.0/src/pages/Admin.tsx`
   - `frontend 2.0/src/pages/Insurance.tsx`
   - `frontend 2.0/src/pages/Facilities.tsx`
   - `frontend 2.0/src/pages/Cost.tsx`
   - `frontend 2.0/src/lib/api.ts`

---

### BACKGROUND & CONTEXT
17 of 33 exported functions in `api.ts` are completely orphaned with 0 callers in the UI.
Entire specifications for ASHA workers (Patients, Referrals, OCR Form Capture, Offline Sync, Facility Capacity) and Admin District Dashboards exist in the backend but have no front-facing UI controls.
Additionally, `Insurance.tsx` has a dead `<button>Apply →</button>` for non-portal schemes that does nothing when clicked.

---

### TASKS TO EXECUTE

#### 4A. ASHA Portal: Patients Tab (`createPatient`, `getPatientTimeline`)
- **File:** `frontend 2.0/src/pages/Asha.tsx`
- **Action:**
  1. Add a `"Patients"` tab to the portal navigation in `AshaPortal`.
  2. Implement an inline `AshaPatients` component:
     - Displays patient cards with `display_name`, `age_band`, and `risk_flags`.
     - Includes a `+ New Patient` modal calling `createPatient(data, token)`.
       (Generate `demographic_hash` from phone + DOB via SHA-256 or pseudo-hash).
     - Clicking a patient card fetches and renders their chronological event timeline via `getPatientTimeline(patientId, token)`.

#### 4B. ASHA Portal: Referrals Tab With Valid State Machine (`createReferral`, `updateReferral`)
- **File:** `frontend 2.0/src/pages/Asha.tsx`
- **State Machine Requirement (`care_service.py`):**
  - Allowed statuses: `"pending"` → `"in_transit"` → `"arrived"` → `"completed"` / `"lost"`.
  - Transitions:
    - `pending` can move to: `in_transit`, `arrived`, `lost`
    - `in_transit` can move to: `arrived`, `lost`
    - `arrived` can move to: `completed`, `lost`
- **Action:**
  1. Add a `"Referrals"` tab to `AshaPortal`.
  2. Implement `AshaReferrals`:
     - Displays referral cards showing patient ID, target facility, urgency tier (L1–L4), and current status badge.
     - "Create Referral" modal: patient ID, `from_facility_id`, `to_facility_id`, `urgency_tier`. Sends `client_created_at: new Date().toISOString()`.
     - Status transition action buttons on each card that ONLY offer the next valid status from `_ALLOWED_TRANSITIONS` (e.g. from `pending`, show "Mark In Transit" or "Mark Arrived"). Calls `updateReferral(id, newStatus, token)`.

#### 4C. ASHA Portal: OCR Form Capture (`uploadForm`, `saveRecord`, `listRecords`)
- **File:** `frontend 2.0/src/pages/Asha.tsx`
- **Action:**
  1. Add a `"Capture"` tab to `AshaPortal`.
  2. Implement `AshaCapture`:
     - Camera/file input for paper forms.
     - Calls `uploadForm(file, token)` to retrieve OCR extraction.
     - Renders extracted fields in an editable review card.
     - "Save Record" button dispatches `saveRecord(recordData, token)`.
     - Displays past digitized records using `listRecords(token)`.

#### 4D. ASHA Portal: Offline Sync Engine With Worker ID from JWT (`syncBatch`)
- **File:** `frontend 2.0/src/pages/Asha.tsx`
- **Worker ID Requirement:**
  `POST /api/sync/batch` requires `worker_id: int`.
  In `frontend 2.0/src/store.ts` or `Asha.tsx`, parse the JWT access token to get `sub`:
  ```ts
  function getWorkerIdFromToken(token: string): number {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return Number(payload.sub) || 1;
    } catch {
      return 1;
    }
  }
  ```
- **Action:**
  1. In the ASHA portal header, render a sync status indicator pill:
     - 🟢 Synced (when online and local queue is empty)
     - 🟡 X Pending (when offline items are queued in `localStorage['ss-sync-queue']`)
     - 🔴 Offline Mode (when `navigator.onLine === false`)
  2. Listen to `window.addEventListener('online', ...)`. When back online, flush the queued records via `syncBatch(workerId, records, triageSessions, token)` and clear the queue on success.

#### 4E. ASHA Portal: Facility Capacity Reporting (`getCapacity`, `reportCapacity`)
- **File:** `frontend 2.0/src/pages/Asha.tsx`
- **Schema Requirement (`CapacityCreate` in `schemas/care.py`):**
  Accepts: `{ facility_id: int, diagnostic_capacity: Record<string, string>, medicine_stock: Record<string, string>, source: string }`.
- **Action:**
  1. Add a `"Capacity"` tab to `AshaPortal`.
  2. Implement `AshaCapacity`:
     - Fetches snapshots via `getCapacity(undefined, token)`.
     - Displays cards with diagnostic availability (X-Ray, Ultrasound, Oxygen) and medicine stock (Essential Drugs, IV Fluids).
     - Provides quick reporting buttons (e.g. "Report Stock Status: Adequate / Critical") calling `reportCapacity({ facility_id, diagnostic_capacity: { "xray": "operational", "oxygen": "available" }, medicine_stock: { "essential_drugs": "adequate" }, source: "asha_portal" }, token)`.

#### 4F. Admin Console: District Analytics Dashboard (`getDistrictDashboard`)
- **File:** `frontend 2.0/src/pages/Admin.tsx`
- **Action:**
  1. Add a `"District View"` tab alongside the current overview.
  2. Include a district selector dropdown.
  3. On selection, fetch data via `getDistrictDashboard(token, districtId)`.
  4. Render a clean 4-card metric grid: Triage volume per urgency tier, referral completion rate, active followups count, and recent capacity reports table.

#### 4G. Insurance: Eliminate Dead "Apply →" Button
- **File:** `frontend 2.0/src/pages/Insurance.tsx` (lines 176–186)
- **Current Defect:** Renders an inactive `<button>{t("in.apply")} →</button>` when `enrollment_method !== "self_service_portal"`.
- **Action:**
  Replace the dead button with honest guidance cards:
  - If `enrollment_method === "self_service_portal"` and `registration_portal_url` exists: Keep the external link `<a>`.
  - Otherwise, render a styled notification card with the appropriate channel instructions (e.g., "Apply at nearest CSC / Common Service Centre" or "Enroll at hospital helpdesk"), with NO misleading clickable button.

#### 4H. Wire & Clean Remaining Functions
- **Files:** `frontend 2.0/src/lib/api.ts`, `Facilities.tsx`, `Cost.tsx`
- **Action:**
  1. In `api.ts`: Delete unused deprecated functions `analyzeIntent` and `analyzeReason`.
  2. In `Facilities.tsx`:
     - Wire `advancedSearch` into an expandable filters accordion.
     - Wire `recommendRoute` into a `"📍 Route Near Me"` GPS button.
  3. In `Cost.tsx`:
     - Wire `estimateCost` into a single-facility price detail breakdown.
  4. In `Admin.tsx`:
     - Add a `"Run Followup Scheduler"` button calling `runFollowupScheduler(token)`.

---

### DETERMINISTIC VERIFICATION CRITERIA
Run:
```powershell
cd "c:\Users\user\projects\SwasthaSetu Ai\frontend 2.0"
npx tsc --noEmit
```
Confirm 0 TypeScript compiler errors and verify that every function in `api.ts` is actively referenced. Output a brief summary and STOP.
```

---

# Prompt 5 of 7 — Phase 5: Backend Data Alignment & Safety Hardening

```markdown
## ROLE & OPERATING MODE: SENIOR BACKEND ENGINEER (MONITOR PERSONA)

You are an expert backend engineer operating under strict **MONITOR PERSONA** and **PONYTAIL PERSONA** guidelines:
1. **Zero Scope Creep:** Execute ONLY the 6 tasks (5A through 5F).
2. **Schema Accuracy:** `AshaRecord` has `created_at` and `synced_at` columns only. It does NOT have `updated_at`. LWW conflict resolution must compare `created_at`.
3. **Target Workspace:** `backend/` directory.

---

### BACKGROUND & CONTEXT
- `dashboard_service.py:30-32` accepts `district_id` as a parameter but never filters DB queries with it, returning global counts for all districts.
- `sync_service.py:24-40` overwrites existing records without comparing creation timestamps, violating Last-Write-Wins offline-sync specification.
- Dead code remains: stale `RED_FLAG_KEYWORDS` in `triage_service.py`, deprecated `ASHA_WORKERS` fixture list in `v2_data.py`.
- `intent_classifier.py` and `pricing_service.py` hardcode cascade models instead of using `provider_registry.get_cascade()`.
- `vision_service.py:256` and `reasoning_engine.py:183` bypass grounding validation when `grounding_reference` is `None` even if RAG chunks were available.
- `docs_raw/` contains ~30 out-of-scope specialized ICMR PDFs (e.g., oncology, microbiology) that pollute primary care triage RAG retrieval.

---

### TASKS TO EXECUTE

#### 5A. Enforce District Scoping in `dashboard_service.py`
- **File:** `backend/app/services/dashboard_service.py` (lines 25–45)
- **Action:**
  When `district_id` is supplied to `district_aggregates()`:
  - Add `.where(TriageSession.district_id == district_id)` on the triage query (if column exists; otherwise join via facility).
  - Add `.where(Referral.district_id == district_id)` on the referral query (or join via `from_facility_id`).

#### 5B. Implement Last-Write-Wins in `sync_service.py` (Comparing `created_at`)
- **File:** `backend/app/services/sync_service.py` (lines 20–45)
- **Schema Note:** `AshaRecord` has `created_at` and `synced_at`. It does NOT have `updated_at`.
- **Action:**
  Before updating an existing `AshaRecord`, compare incoming timestamp against existing `created_at`:
  ```python
  device_created_at = payload.created_at or datetime.now(timezone.utc)
  now_ts = datetime.now(timezone.utc)

  if existing_pk is not None:
      existing = await db.get(AshaRecord, existing_pk)
      # Last-Write-Wins: if incoming record is older than existing record's created_at, skip overwrite
      if existing.created_at and device_created_at <= existing.created_at:
          logger.info("[Sync] Ignored stale update for device_local_id=%s (incoming %s <= existing %s)",
                      device_local_id, device_created_at, existing.created_at)
          return existing, False

      existing.record_type = payload.record_type
      existing.structured_fields = payload.structured_fields
      existing.created_at = device_created_at
      existing.synced_at = now_ts
      await db.flush()
      return existing, False
  ```

#### 5C. Delete Dead Code & Add SQLite DB to Gitignore
- **Action:**
  1. In `backend/app/services/triage_service.py`: Delete the deprecated `RED_FLAG_KEYWORDS` tuple (lines 15–45) if orphaned.
  2. In `backend/app/services/v2_data.py`: Delete the static `ASHA_WORKERS` fixture list (lines 266–272).
  3. Ensure `*.db` and `*.sqlite3` are present in `.gitignore`.

#### 5D. Centralize Cascade Selection via `provider_registry`
- **Files:**
  - `backend/app/services/intent_classifier.py` (lines 105–125)
  - `backend/app/services/pricing_service.py` (lines 160–180)
- **Action:**
  Replace hardcoded cascade model tuples with `provider_registry.get_cascade("text")`.

#### 5E. Close Grounding Verification Bypass
- **Files:**
  - `backend/app/services/vision_service.py` (lines 250–265)
  - `backend/app/services/reasoning_engine.py` (lines 175–195)
- **Action:**
  In both files, if `result.grounding_reference is None` while retrieved RAG chunks were non-empty (`len(guideline_chunks) > 0`), treat this as a cascade stage failure. Log a warning and `continue` to the next cascade provider instead of returning an unverified result.

#### 5F. Quarantine Out-of-Scope Research PDFs
- **Target Directory:** `docs_raw/`
- **Action:**
  Create directory `docs_raw/_quarantine/out_of_scope/` and move specialist non-triage PDFs (e.g., oncology, deep surgical procedures, antimicrobial stewardship) into it so RAG ingestion focuses exclusively on primary care triage guidelines.

---

### DETERMINISTIC VERIFICATION CRITERIA
Run:
```powershell
cd "c:\Users\user\projects\SwasthaSetu Ai\backend"
python -c "from app.main import app; from app.services.sync_service import upsert_record; print('PHASE 5 BACKEND INTEGRITY VERIFIED')"
```
Output a brief change log and STOP.
```

---

# Prompt 6 of 7 — Phase 6: i18n & Localization Fixes

```markdown
## ROLE & OPERATING MODE: SENIOR LOCALIZATION & FRONTEND ENGINEER (MONITOR PERSONA)

You are an expert frontend engineer operating under strict **MONITOR PERSONA** and **PONYTAIL PERSONA** guidelines:
1. **Zero Scope Creep:** Modify ONLY localization assets: `frontend 2.0/src/i18n.ts`, `frontend 2.0/src/pages/Landing.tsx`, `frontend 2.0/index.html`, and `frontend 2.0/src/index.css`.
2. **Target Workspace:** `frontend 2.0/`

---

### BACKGROUND & CONTEXT
- In `frontend 2.0/src/i18n.ts`, the 8 non-English Indic locales (`hi`, `bn`, `te`, `ur`, `mr`, `ta`, `kn`, `gu`) still contain the outdated demo login hint: `"डेमो: कोई भी नंबर चलेगा। एडमिन: 9999999999।"` instead of directing users to their district admin.
- Ten newly introduced keys (`c.directions`, `co.treatment`, `co.affordable`, `in.docs`, `in.guidePortal`, `in.guideCsc`, `in.guideFacility`, `in.guideFallback`, `as.username`, `as.password`) are missing from Indic locale dictionaries.
- Landing page and i18n strings feature fabricated statistics ("31,000+ hospitals", "1,000+ treatments", "80%", "60%") that should be replaced with honest, factual copy.
- Indic script typography lacks proper web fonts, causing glyph rendering issues on some systems.

---

### TASKS TO EXECUTE

#### 6A. Correct `as.loginHint` Across All 8 Indic Locales
- **File:** `frontend 2.0/src/i18n.ts`
- **Action:** Update `as.loginHint` in all non-English dictionaries:
  - **hi:** `"अपने जिला प्रशासन द्वारा जारी खाते से साइन इन करें।"`
  - **bn:** `"আপনার জেলা প্রশাসক দ্বারা প্রদত্ত অ্যাকাউন্ট দিয়ে সাইন ইন করুন।"`
  - **te:** `"మీ जिल्हा నిర్వాహకుడు జారీ చేసిన ఖాతాతో సైన్ ఇన్ చేయండి."`
  - **ur:** `"اپنے ضلعی منتظم کے جاری کردہ اکاؤنٹ سے سائن ان کریں۔"`
  - **mr:** `"तुमच्या जिल्हा प्रशासनाने दिलेल्या खात्याने साइन इन करा."`
  - **ta:** `"உங்கள் மாவட்ட நிர்வாகி வழங்கிய கணக்கைப் பயன்படுத்தி உள்நுழையவும்."`
  - **kn:** `"ನಿಮ್ಮ ಜಿಲ್ಲಾ ನಿರ್ವಾಹಕರು ನೀಡಿದ ಖಾತೆಯಿಂದ ಸೈನ್ ಇನ್ ಮಾಡಿ."`
  - **gu:** `"તમારા જિલ્લા વહીવટકર્તાએ આપેલા ખાતાથી સાઇન ઇન કરો."`

#### 6B. Populate Missing Translation Keys
- **File:** `frontend 2.0/src/i18n.ts`
- **Action:** Ensure the following 10 keys exist in `en` and all 8 Indic dictionaries:
  `c.directions`, `co.treatment`, `co.affordable`, `in.docs`, `in.guidePortal`, `in.guideCsc`, `in.guideFacility`, `in.guideFallback`, `as.username`, `as.password`.

#### 6C. Replace Fabricated Statistics With Honest Copy
- **Files:** `frontend 2.0/src/i18n.ts` and `frontend 2.0/src/pages/Landing.tsx`
- **Action:**
  - Replace `"31,000+ hospitals"` with `"Government hospitals across India"`.
  - Replace `"1,000+ treatments"` with `"Treatments and procedures tracked"`.
  - In `Landing.tsx`, adjust the problem section copy to reflect comparative public rates and scheme coverage rather than unsubstantiated claims.

#### 6D. Load Indic Web Fonts
- **Files:**
  - `frontend 2.0/index.html`
  - `frontend 2.0/src/index.css`
- **Action:**
  1. In `index.html` `<head>`, add Google Fonts link for:
     - `Noto Sans Devanagari:wght@400;600`
     - `Noto Sans Bengali:wght@400;600`
     - `Noto Sans Telugu:wght@400;600`
  2. In `index.css`, add font-family rules keyed to HTML lang attributes:
     ```css
     [lang="hi"], [lang="mr"] { font-family: 'Noto Sans Devanagari', 'Space Grotesk', sans-serif; }
     [lang="bn"] { font-family: 'Noto Sans Bengali', 'Space Grotesk', sans-serif; }
     [lang="te"] { font-family: 'Noto Sans Telugu', 'Space Grotesk', sans-serif; }
     ```

---

### DETERMINISTIC VERIFICATION CRITERIA
Run:
```powershell
cd "c:\Users\user\projects\SwasthaSetu Ai\frontend 2.0"
npx tsc --noEmit
```
Confirm 0 TypeScript compiler errors. Output a brief summary and STOP.
```

---

# Prompt 7 of 7 — Phase 7: End-to-End Verification & Final Polish

```markdown
## ROLE & OPERATING MODE: LEAD QA & VERIFICATION ENGINEER (MONITOR PERSONA)

You are the final verification gatekeeper operating under strict **MONITOR PERSONA** and **PONYTAIL PERSONA** guidelines:
1. **Verification-Only Mandate:** Do not introduce architectural changes. Your responsibility is to test, audit, and verify that the system is 100% bug-free and compliant with all 27 documentation specs.
2. **Target Workspace:** Entire repository (`backend/` and `frontend 2.0/`).

---

### BACKGROUND & CONTEXT
This is the final phase of the implementation roadmap.
All critical bugs, hybrid data fallbacks, UI modules, backend alignments, and localizations must now be verified through automated tests and a strict 30-point audit checklist.

---

### TASKS TO EXECUTE

#### 7A. Fix `AshaRegister` State Dropdown List
- **File:** `frontend 2.0/src/pages/Asha.tsx` (lines 155–165)
- **Action:**
  Replace the hardcoded 5-state list with the complete list of Indian states and union territories from `constants.ts`. Expand `STATES` in `src/lib/constants.ts` to include all 36 states and UTs.

#### 7B. Create Automated Playwright E2E Smoke Tests
- **Directory:** `frontend 2.0/e2e/`
- **Action:**
  Create `frontend 2.0/e2e/smoke.spec.ts` covering the 6 critical user journeys:
  1. **Triage Journey:** Submit text symptoms and verify the full result card appears with Level badge, conditions, and advice.
  2. **Cost Estimation Journey:** Select disease and city, execute search, verify results and `as_of` date.
  3. **Insurance Scheme Matcher:** Fill profile, verify matched schemes render with honest guidance or working registration portal links (no dead buttons).
  4. **Facility Navigator:** Search city facilities, verify pins and working Google Maps `Directions` links.
  5. **ASHA Authentication & Care Flow:** Authenticate, verify all 5 tabs (Follow-ups, Patients, Referrals, Capture, Capacity) load data from the backend.
  6. **Admin Governance Console:** Login as admin, verify analytics metrics and pending user review actions.

#### 7C. Execute Backend Integration Verification
- **File:** `backend/scripts/e2e_verify.py`
- **Action:**
  Run the backend test script to verify that:
  - Uncached cities fall back to the SQL `Facility` table.
  - Procedures fall back to the `GovernmentCost` table.
  - Scheme matching returns valid portal URLs.

#### 7D. Execute Formal 30-Point Audit Checklist
Inspect the codebase to verify every item below. Output the final score as `X/30 PASS`:

```
[ ] 1. precision_service.py gates DDGS behind ENABLE_WEB_SCRAPE with try/except
[ ] 2. etl_financial.py loops through all cascade providers
[ ] 3. VisionSignalOut has grounding_reference, grounding_verified, reason fields
[ ] 4. v2_data.py CONDITIONS has NO named diagnoses or drug dosages
[ ] 5. source_monitor.py check_one defaults to fetch_content (not _raise_unreachable)
[ ] 6. v3_intent.py writes to safety_override_log with SHA-256 hash (no raw text)
[ ] 7. ci.yml points to "frontend 2.0"
[ ] 8. requirements.txt includes sentence-transformers
[ ] 9. search_facilities falls back to SQL Facility table (district/state + pm_jay_empaneled)
[ ] 10. estimate_cost and cost_alternatives attach as_of from GovernmentCost
[ ] 11. match_schemes merges in-memory and SQL schemes honestly
[ ] 12. Triage.tsx image remove button clears both image and imageFile
[ ] 13. Triage.tsx maps age index to string ('child'|'adult'|'senior') preventing 422
[ ] 14. Triage.tsx renders vision_signal, reasoning, matched, advice, verified_sources
[ ] 15. api.ts has 0 unused exported functions
[ ] 16. Insurance.tsx has NO dead Apply buttons
[ ] 17. Asha.tsx contains active Patients tab with timeline view
[ ] 18. Asha.tsx contains active Referrals tab with valid state machine (pending->in_transit->arrived->completed/lost)
[ ] 19. Asha.tsx contains active OCR Capture tab
[ ] 20. Asha.tsx contains active Offline Sync engine with worker_id from JWT sub
[ ] 21. Asha.tsx contains active Facility Capacity tab matching CapacityCreate schema
[ ] 22. Admin.tsx contains active District Dashboard tab
[ ] 23. Facilities.tsx features Advanced Search and Route GPS button
[ ] 24. dashboard_service.py filters queries by district_id
[ ] 25. sync_service.py enforces Last-Write-Wins via created_at timestamp
[ ] 26. intent_classifier.py uses provider_registry.get_cascade
[ ] 27. Grounding verification rejects null citations when RAG chunks exist
[ ] 28. All 8 Indic locales have updated as.loginHint and 10 new keys
[ ] 29. Indic fonts loaded in index.html and index.css
[ ] 30. Playwright E2E suite passes all 6 flows
```

---

### DETERMINISTIC VERIFICATION CRITERIA
Report the audit score, verify that zero compilation errors exist on both backend and frontend, and confirm the system is ready for production. STOP.
```
