# Document 4 — Frontend Product Specification
**Status key:** 🟢 EXISTING · 🟡 EXTEND · 🔴 NEW

---

## 1. Design Philosophy

- **Visual identity:** glassmorphism over a calm clinical palette — the aesthetic signals "trustworthy government-adjacent tool," not "flashy consumer app," while still feeling modern enough to win a "wow" reaction from judges.
- **Color system:** primary teal/blue for routine states, amber for `CONSULT_SOON`, red reserved *exclusively* for L4 Emergency (never used decoratively elsewhere in the UI, so its appearance always reads as significant).
- **Typography:** script-paired fonts per language (e.g., Noto Sans Devanagari for Hindi, Noto Sans Bengali for Bengali) — a single Latin-only font stack is treated as an i18n bug.
- **Interaction principle:** every irreversible or safety-relevant action (submitting a triage, confirming a referral) requires a single unambiguous tap — no nested menus between a user and an emergency-relevant action.

## 2. Site Map

```
/                          Landing (language selector, mode: Patient / ASHA / Admin)
├── /triage                🟢 Symptom entry (text/voice/photo) → result
│   └── /triage/result     🟢 Urgency tier, disclaimer, next-step routing
├── /cost                  🟢 Cost Analyzer (disease → hospital → funding route → estimate)
├── /schemes               🟢 Scheme eligibility checker
├── /facilities            🟢 Map + list of routed facilities
├── /asha                  🟢 ASHA field mode (role-gated)
│   ├── /asha/capture       🟢 Photo → OCR → voice-confirm form
│   ├── /asha/patients      🔴 NEW — patient list + timeline (FR-9)
│   ├── /asha/referrals     🔴 NEW — create/update referral (FR-10)
│   └── /asha/followups     🔴 NEW — follow-up worklist (FR-11)
└── /admin                 🟢🔴 Admin mode (role-gated)
    ├── /admin/overview      🟢 Existing summary
    └── /admin/dashboard     🔴 NEW — district dashboard (FR-13)
```

## 3. Page-by-Page Wireframe Descriptions

### 3.1 `/triage` 🟢
- **Layout:** single-column on mobile, centered 2-column on desktop (input left, live guidance right).
- **Elements:** language selector (dropdown, top-right, persists via URL param `?lang=`), text input with mic-icon voice-entry toggle, camera-icon photo-upload button, "Check symptoms" primary button.
- **API call:** on submit → `POST /v2/triage`.
- **Loading state:** skeleton pulse on the result panel; mic button shows a waveform animation during voice capture.
- **Error state:** if all 3 vision providers fail (image path only), show *"We couldn't analyze the photo, but your symptom description has been checked"* — never a raw error message.
- **Empty state:** N/A (input required before submit is enabled).
- **Animation:** Framer Motion spring transition from input view to result view; no animation on the disclaimer text (it must render instantly, not fade in, for safety-critical visibility).
- **Mobile:** camera button opens native file/camera picker; voice button requests mic permission with a plain-language rationale string.

### 3.2 `/triage/result` 🟢
- **Layout:** large urgency-tier badge (color per §1) at top, disclaimer directly beneath it (always visible, no scroll required), routing CTA below.
- **Elements:** tier badge, confidence/source tag, "Find nearest facility" button → `/facilities`, "Estimate cost" button → `/cost`.
- **If `vision_downgrade_blocked: true`:** a distinct amber banner explaining the override, per `04_AI_SAFETY_ETHICS.md` §5 copy.

### 3.3 `/cost` 🟢
- **Layout:** stepper (Disease → Hospital type → Funding route → Result), single visible step at a time on mobile.
- **Elements:** searchable disease dropdown (10 seeded diseases), hospital-type toggle (Government/Private), funding-route radio (PM-JAY / Private insurance / Uninsured), demographic mini-form (only shown for PM-JAY route).
- **API call:** `POST /v2/cost` on final step.
- **Result display:** itemized breakdown table, `confidence` tag rendered as a colored chip next to the total.

### 3.4 `/asha/patients` 🔴 NEW
- **Layout:** searchable list (search by name or demographic hash prefix) → tap → timeline detail view.
- **Elements:** list rows show name, age band, risk flags as small icon chips; detail view is a vertical timeline (`patient_events` rendered chronologically, each event type with its own icon).
- **API call:** `GET /v3/patients/{id}/timeline`.
- **Empty state:** *"No patients recorded yet — capture your first record from the field-capture screen."*
- **Loading state:** skeleton timeline rows.

### 3.5 `/asha/referrals` 🔴 NEW
- **Layout:** form (Patient → From facility → To facility → Urgency, pre-filled if arriving from a triage result) + a status list of the ASHA's own open referrals below it.
- **Elements:** patient search-select, facility search-select (from `/v2/facilities/search`), urgency badge (read-only, inherited from triage), submit button, status list with colored status chips (`pending`/`in_transit`/`arrived`/`completed`/`lost`).
- **API calls:** `POST /v3/referrals` on submit; `PATCH /v3/referrals/{id}` from the status list's inline status-change control.

### 3.6 `/asha/followups` 🔴 NEW
- **Layout:** flat worklist, sorted by `due_date` ascending (most overdue first), one card per patient.
- **Elements:** patient name, reason chip (maternal/child/chronic), days-overdue counter, "Mark visited" button (writes a new `patient_events` row and clears the worklist entry).
- **API call:** `GET /v3/patients?followups=true` (or a dedicated worklist endpoint — decide during backend implementation) and the mark-visited action posts a new event.

### 3.7 `/admin/dashboard` 🔴 NEW
- **Layout:** 4-card grid on desktop, stacked on mobile — Triage Volume (bar chart by tier), Referral Completion Rate (gauge), Follow-up Backlog (number + trend), Facility Load (table).
- **API call:** `GET /v3/dashboard/district`.
- **Loading state:** cards individually skeleton-load (don't block the whole grid on the slowest query).
- **Refresh behavior:** manual refresh button, not auto-polling — protects the Render free-tier backend from constant dashboard load.

## 4. Component Library

| Component | Variants | Key props | Accessibility notes |
|---|---|---|---|
| `Button` | primary, secondary, danger (reserved for emergency-context actions) | `label`, `onClick`, `loading`, `disabled` | 44×44px minimum hit target; `aria-busy` when `loading` |
| `UrgencyBadge` 🟢 | L1–L4, each a fixed color per §1 | `tier`, `source` | Color is never the *only* signal — badge always includes the tier text label too, for colorblind users |
| `LanguageSelector` 🟢 | dropdown | `value`, `onChange`, `options[]` | Keyboard-navigable listbox pattern |
| `SearchSelect` | disease, facility, patient variants | `options[]`, `onSelect`, `placeholder` | `aria-autocomplete="list"` |
| `Card` | default, glass (glassmorphism variant) | `children`, `elevation` | N/A (presentational) |
| `Timeline` 🔴 NEW | patient event timeline | `events[]` | Each event announced via `aria-label` combining type + date for screen readers |
| `Gauge` | used for referral completion rate | `value`, `max`, `label` | Numeric value always rendered as text alongside the visual gauge |
| `ConfidenceTag` | verified / community / uncertain | `source` | Not color-only — text label always present |
| `Modal` | default | `open`, `onClose`, `children` | Focus-trapped, `Esc` closes, returns focus to trigger element |
| `MapView` 🟢 | facility search, single facility | `facilities[]`, `center` | Fallback: styled SVG placeholder if tile load fails (never a blank/broken map) |

## 5. State Management Strategy

| Data | Location | Rationale |
|---|---|---|
| Auth token, user role | Global store (React context) + encrypted local storage | Needed across every protected route |
| Current language | URL param `?lang=` + global store | Shareable/bookmarkable, survives refresh |
| Triage/cost in-progress form state | Local component state | Scoped to a single flow, no cross-page need |
| ASHA offline capture queue | SQLite (client-side) mirrored into a global store slice for UI badge counts ("3 records pending sync") | Must survive app restarts, not just in-memory state |
| Dashboard aggregates | Local state, fetched on mount + manual refresh | No need for global sharing; single-page consumer |

## 6. Internationalization Plan

- **Supported languages:** the existing 9 Indian languages already covered by the i18n engine.
- **Translation key structure:** namespaced by feature — `triage.disclaimer`, `cost.step1.title`, `asha.followups.overdue_label` — never bare strings, to keep the safety-critical disclaimer copy auditable as its own key group.
- **Font pairing:** Noto Sans [Script] per language, loaded only for the active language to protect the bundle-size NFR.

## 7. Accessibility Checklist (WCAG 2.1 AA)

- [ ] All interactive elements reachable via Tab, in a logical order
- [ ] Focus indicator visible on every focusable element (no `outline: none` without a replacement)
- [ ] Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text/icons
- [ ] Touch targets ≥ 44×44px on all mobile breakpoints
- [ ] Every image/icon has an `alt`/`aria-label`; decorative icons marked `aria-hidden`
- [ ] Form errors announced via `aria-live="polite"` regions, not color alone
- [ ] Screen-reader pass on `/triage/result` specifically — this is the safety-critical page and gets a dedicated manual audit, not just the automated scan

## 8. Design Tokens

```css
:root {
  /* Semantic colors */
  --color-bg:            #0B1220;  /* deep navy, glassmorphism base */
  --color-surface:       rgba(255,255,255,0.06);  /* glass panel */
  --color-text-primary:  #F5F7FA;
  --color-text-muted:    #9AA5B1;
  --color-accent:        #2DD4BF;  /* teal — primary interactive */
  --color-tier-routine:  #2DD4BF;  /* L1 */
  --color-tier-consult:  #FBBF24;  /* L2 — amber */
  --color-tier-urgent:   #FB923C;  /* L3 — orange */
  --color-tier-emergency:#EF4444;  /* L4 — red, reserved exclusively for this */
  --color-success:       #34D399;
  --color-danger:        #EF4444;

  /* 4px spacing grid */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;

  /* Radius / shadow / blur */
  --radius-card: 16px;
  --shadow-glass: 0 8px 32px rgba(0,0,0,0.25);
  --blur-glass: blur(12px);
}
```
**Typography scale:** 12/14/16/18/24/32/40px, line-height 1.5 for body, 1.2 for headings; Noto Sans [Script] per active language (§6).
**Animation principles:** Framer Motion spring config `{ stiffness: 300, damping: 30 }` for panel transitions; 150–250ms duration for micro-interactions (button press, toggle); the safety disclaimer on `/triage/result` is explicitly exempt from entry animation — it renders instantly (§3.2).

## 9. Component Library — TypeScript Interfaces

```typescript
interface UrgencyBadgeProps {
  tier: "L1" | "L2" | "L3" | "L4";
  source: "deterministic" | "gemini" | "groq" | "nvidia" | "uncertain";
  visionDowngradeBlocked?: boolean;
}

interface SearchSelectProps<T> {
  options: T[];
  value: T | null;
  onSelect: (value: T) => void;
  placeholder: string;
  getLabel: (item: T) => string;
  loading?: boolean;
  emptyMessage?: string;
}

interface TimelineProps {
  events: PatientEvent[];          // see 03_SYSTEM_ARCHITECTURE.md §6.2 patient_events shape
  loading?: boolean;
  emptyMessage?: string;
}

interface ConfidenceTagProps {
  source: "verified_official_data" | "community_estimate_unverified" | "uncertain";
  value?: number;   // 0-1, omitted for deterministic (N/A) results
}

interface GaugeProps {
  value: number;
  max: number;
  label: string;
  formatValue?: (v: number) => string;
}
```

## 10. Locale Formatting

| Locale aspect | Rule |
|---|---|
| Currency | Always ₹ (INR), Indian digit grouping (e.g., `₹1,00,000` not `₹100,000`) |
| Date | `DD MMM YYYY` in Latin-script languages; locale-appropriate script + same field order otherwise |
| Numbers | Indian numbering system (lakh/crore) in all languages, since the target audience's mental model is lakh/crore regardless of script |
| RTL (Urdu, if included among the 9) | Full `dir="rtl"` layout mirroring — this must be explicitly tested, not assumed to "just work" from CSS logical properties alone; add a dedicated RTL QA pass (`09_QA_TEST_PLAN.md`) before claiming Urdu support in the pitch |
| Pluralization | Most target languages don't pluralize the way English does — translation keys use count-aware ICU MessageFormat-style templates (`{count, plural, one{...} other{...}}`) rather than naive string concatenation |
