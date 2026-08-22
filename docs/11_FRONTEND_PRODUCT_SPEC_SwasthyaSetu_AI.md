# Frontend Product Specification (v3 — Production-Grade)
## SwasthyaSetu AI — Website (Stage 1)

**Supersedes/operationalizes:** the user-authored "Frontend Concept Overview (v2)" and formalizes the principles in the `App & Website Design` document (07) into a build-ready, SaaS-grade specification.
**Companion documents:** PRD (01), Tech Stack (02), System Architecture (03), AI Training System (08). This document assumes the reader has those, and calls out exactly where this spec requires changes to them.

---

## 1. Analysis of the v2 Concept — What's Strong, What's Been Elevated

Your v2 concept is unusually complete for a hackathon-stage doc — the sub-tab data sync (Financial Availability → Treatment Cost), the Path A/B branching in the Symptom Detector, and the ASHA dual-state (public directory vs. logged-in dashboard) are all genuinely production-grade thinking. This revision keeps every one of those decisions and adds the layer needed to make it buildable, consistent, and demo-proof:

| Gap in v2 | What This Document Adds |
|---|---|
| No design system (colors, type, spacing, motion) defined — "premium glassmorphism" is a vibe, not a spec a developer can implement consistently | Full design token system (§4) |
| Urgency labels are inconsistent — the Symptom Detector section says results can be "SEVERE, SERIOUS, or EMERGENCY," then the ASHA section refers to "4 critical/severe emergency categories" | Reconciled against the AI Training System document's existing 3-tier taxonomy — see §1.1 below, a decision is required |
| Premium 3D/glassmorphism landing page risks breaking the PRD's non-functional requirement that the site "load and respond on 3G-equivalent bandwidth" and stay "usable on low-end mobile browsers" | Two-Layer Experience Strategy (§2) — premium effects are adaptive, not universal |
| The Symptom Detector's rich input form (age, gender, duration, severity, medical history, image upload) exceeds the `/predict/triage` API contract already defined in the AI Training System document, which only accepts `{text, language}` | API contract extended (§10.1) — coordinated update needed in doc 08 |
| "Live AI Sync" to the ASHA Emergency Board implies real-time push, which has no architecture yet | Real-time notification architecture specified (§9.5) — coordinated update needed in doc 03 |
| The Financial Affordability engine, Insurance Coverage & Gap Report, and Treatment Cost recommendation logic are described as features but have no backend service defined | Three new backend service modules specified (§9) |
| "Fully walkable, no dummy buttons" is stated as a rule but has no way to verify compliance | A complete button-to-endpoint inventory (§11) that doubles as a build checklist |
| No accessibility spec attached to the premium aesthetic — risk of the "premium SaaS" direction silently breaking the low-literacy accessibility requirements already established in doc 07 | WCAG 2.1 AA baked into every page spec, not bolted on afterward (§8) |

### 1.1 Decision Required: Urgency Tier Count
Your document uses "SEVERE, SERIOUS, or EMERGENCY" in one place and "4 critical/severe emergency categories" in another. The AI Training System document (already built, with a trained-model evaluation methodology, dataset schema, and safety rules attached to it) is built around exactly **three** fixed tiers: `EMERGENCY`, `CONSULT_SOON`, `SELF_CARE_ADVISORY`. Two options:

- **Option A (recommended):** Keep the 3-tier system everywhere. Update the frontend copy to display `EMERGENCY` as a single highest-severity state, with `CONSULT_SOON` and `SELF_CARE_ADVISORY` covering the rest. This preserves every safety rule, dataset, and evaluation bar already built in doc 08 — no rework needed anywhere else.
- **Option B:** Expand to 4 tiers (e.g., split `EMERGENCY` into `CRITICAL` and `SEVERE`). This requires reopening docs 05, 06, 07, and 08 — new red-flag rules, retrained model taxonomy, new evaluation thresholds — a non-trivial amount of rework for a distinction that mostly matters for UI framing.

**This document proceeds with Option A.** If you want Option B, say so explicitly and the affected sections of docs 05–08 will need a follow-up pass.

---

## 2. Design Philosophy — The Two-Layer Experience Strategy

This resolves the core tension in your brief: you want a premium, 3D, glassmorphism SaaS feel, but the PRD's actual users (per doc 01, §4) are often low-literacy, first-time smartphone users on low-end devices with unreliable connectivity. Trying to make every screen simultaneously "premium 3D" and "usable on a cracked ₹6,000 Android phone on 2G" produces a worse product on both fronts. Instead, split the experience:

**Layer 1 — Arrival Layer (Landing Page only):** This is the "front door" — what a judge, investor, NGO partner, or curious first-time visitor sees. Full premium treatment: 3D dynamic transitions, glassmorphism, motion. This layer is allowed to be visually ambitious because it's a single, isolated page, and its purpose is first impression and trust-building, not task completion under constraint.

**Layer 2 — Core Product Layer (Homepage and every functional tab):** This is where real users do real tasks — symptom triage, cost lookup, scheme matching, ASHA workflows. Here, "premium" means **clarity, speed, and polish**, not heavy visual effects. A clean, professional SaaS look (generous whitespace, confident typography, subtle shadows, purposeful color) reads as premium and is fast and accessible. This is the layer doc 07's accessibility principles govern without compromise.

The transition between layers (Landing → Homepage) is itself a moment of delight — the "smooth 3D dynamic transition" you specified in v2 — and then the app settles into its calmer, faster, core identity. This is a standard, well-understood SaaS pattern (marketing site vs. app shell) and it's exactly the right instinct for this product.

**Adaptive rule for Layer 1:** detect low bandwidth/low device memory (via the `navigator.connection` and `navigator.deviceMemory` browser APIs, with `prefers-reduced-motion` always respected) and serve a static, lightweight version of the landing page (gradient background, no 3D canvas, simple fade transition) instead of the full effect. This is a few lines of conditional logic and it's the difference between "impressive" and "actually broken" for a meaningful slice of your real user base.

---

## 3. Confirmed Technical Foundation

- **Framework:** React + Vite, single framework across every page — no exceptions, per your Tech Stack Rule. (This updates and locks in doc 02, which previously left Next.js as an option — see §12.)
- **Styling:** Tailwind CSS (already specified in doc 02), extended with the design tokens in §4.
- **Component primitives:** Radix UI primitives (via shadcn/ui) for anything interactive — dialogs/modals, dropdowns, toggles, tabs — because they come with keyboard navigation and screen-reader semantics built in, which is non-negotiable given the accessibility requirement.
- **Routing:** React Router v6, with the route map in §5.
- **Global/server state:** TanStack Query (React Query) for all API data (facility lists, scheme matches, triage results) — gives you caching, loading/error states, and retry logic for free, which matters a lot for the "fully walkable, every button works" rule. Zustand for lightweight global UI state (selected language, logged-in ASHA session, synced financial-affordability data between Sub-Tab A and B).
- **Forms:** React Hook Form + Zod for schema validation — every form in this spec (Symptom Detector, Financial Affordability, Insurance Checker, ASHA Registration) is validated client-side against a shared schema before it ever reaches the API.
- **Animation:** Framer Motion for page/element transitions and the landing page's 3D dynamic transition; kept out of Layer 2 except for small, purposeful micro-interactions (§7).
- **Maps:** Leaflet + OpenStreetMap tiles as the default (no API key, no cost, fully sufficient for facility pins and routing) rather than Google Maps/Mapbox, to avoid a paid dependency for a hackathon-stage build — see §12 for the trade-off and how to swap to Mapbox later if turn-by-turn directions become a hard requirement.
- **i18n:** i18next + react-i18next (already specified in doc 02), extended in §6.1.

---

## 4. Design System

### 4.1 Color Tokens
| Token | Use | Notes |
|---|---|---|
| `--color-primary` | Primary actions, active nav, links | A confident, trustworthy blue or teal — avoid red/yellow/green entirely outside urgency signaling |
| `--color-primary-dark` | Hover/pressed states | |
| `--color-surface` | Card/panel backgrounds | White or near-white in Layer 2; translucent glass in Layer 1 only |
| `--color-background` | Page background | |
| `--color-text-primary` / `--color-text-secondary` | Body text hierarchy | Minimum 4.5:1 contrast ratio against background (WCAG AA) |
| `--color-urgency-emergency` | Reserved exclusively for `EMERGENCY` results | Red — never reused decoratively anywhere else in the UI |
| `--color-urgency-consult` | Reserved exclusively for `CONSULT_SOON` | Amber/yellow — same rule |
| `--color-urgency-selfcare` | Reserved exclusively for `SELF_CARE_ADVISORY` | Green — same rule |
| `--color-scheme-badge` | PM-JAY/PMBJP/AMRIT trust badges | A distinct government-associated color (e.g., a navy/gold combination), consistent everywhere the badge appears |

**Hard rule carried over from doc 07:** urgency colors are never used for anything else in the interface (no green "success" toasts, no red "error" states using the same red) — this preserves the color's meaning as a safety signal at a glance.

### 4.2 Typography
- **Typeface:** one variable font family covering Latin + Devanagari + Bengali (+ other target scripts) — e.g., Noto Sans and its regional variants, which guarantees every language in the switcher renders correctly without a fallback-font flash.
- **Scale:** a standard modular scale (e.g., 12 / 14 / 16 / 20 / 24 / 32 / 48px), with body text minimum 16px (never smaller, per doc 07's accessibility rule).
- **Weight usage:** Regular for body, Semibold for headings/labels, Bold reserved for urgency results and key numbers (costs, coverage amounts) so the eye goes there first.

### 4.3 Spacing, Radius, Elevation
- **Spacing scale:** 4px base unit (4/8/12/16/24/32/48/64) — consistent across every component, no arbitrary values.
- **Radius:** consistent rounded corners (e.g., 12px for cards, 8px for buttons/inputs, full-round for badges/avatars) — this is a large part of what makes an interface *read* as premium/SaaS rather than default-browser.
- **Elevation (Layer 2):** subtle, consistent shadow levels (e.g., 3 tiers: resting, hover, modal) — never harsh drop-shadows.
- **Glassmorphism (Layer 1 only):** `backdrop-filter: blur(20px)` over a translucent surface (`rgba` white/dark at 10–20% opacity) with a 1px semi-transparent border — this is the actual CSS mechanism behind the "glassmorphism" look you specified, confined to the landing page per §2.

### 4.4 Motion Tokens
- **Durations:** micro-interactions 150–200ms, panel/page transitions 300–400ms, the landing page's signature 3D transition 600–800ms (once, not repeated).
- **Easing:** a single consistent easing curve (e.g., `cubic-bezier(0.16, 1, 0.3, 1)`, an "ease-out-expo" feel) used everywhere — this consistency is what makes motion feel designed rather than default.
- **Reduced motion:** every animation must have a `prefers-reduced-motion` fallback that swaps to an instant/cross-fade transition — required for accessibility compliance, not optional.

### 4.5 Iconography
- One consistent icon set throughout (e.g., Lucide or Phosphor icons, both free/open and already common in the shadcn/ui ecosystem) — never mix icon styles. Every icon in a primary action pairs with a native-language text label, per doc 07's icon-driven navigation principle.

---

## 5. Information Architecture & Route Map

```
/                              → Landing Page (Layer 1)
/home                          → Homepage (dashboard hub)
/symptom-detector               → AI Symptom Detector (two-column)
/cost-check                     → Treatment Cost & Financial Availability
  /cost-check/financial-availability   → Sub-Tab A
  /cost-check/treatment-cost           → Sub-Tab B
/insurance-schemes               → Insurance Policy & Government Scheme Checker
  /insurance-schemes/policy-checker    → Sub-Tab A
  /insurance-schemes/scheme-finder     → Sub-Tab B
/facilities                      → Facility Navigator (map view)
/asha                             → ASHA Health Worker
  /asha/login                    → Login
  /asha/register                 → Registration
  /asha/dashboard                → Dashboard (protected route, requires auth)
/how-it-works                    → Explainer page (referenced from Landing, built last per your note)
```

All `/asha/dashboard/*` routes are protected — unauthenticated access redirects to `/asha/login`, implemented via a route guard reading the Zustand auth store.

---

## 6. Global Systems

### 6.1 Universal Language Switcher
- **Placement:** persistent in the header across every route (including Landing) per your spec.
- **Implementation:** i18next with a language context provider wrapping the whole app; selected language stored in Zustand and persisted so it survives a page refresh.
- **Coverage rule:** every user-facing string — including form labels, button text, error messages, and toast notifications, not just page headings — must be routed through the i18n layer. No hardcoded strings in components; this is enforced by convention/lint rule, not just discipline.
- **Native-language input:** no special handling needed for typing Hindi/Bengali/etc. directly into text areas — this works natively in any modern browser input; the only requirement is setting the correct `lang` attribute on the input dynamically based on selected language, which improves screen-reader pronunciation and spell-check behavior.
- **Fallback:** if a translation string is missing for a selected language, fall back to English rather than showing a blank/broken label — never a silent failure.

### 6.2 Authentication (ASHA Workers)
- JWT-based auth (per doc 02's OAuth 2.0/JWT decision), issued on login, stored in memory + a secure httpOnly cookie for refresh (never in `localStorage`, to reduce XSS exposure to a credential that unlocks patient data).
- Route guard on all `/asha/dashboard/*` paths.
- Registration flow includes the fields needed to populate the public ASHA directory (name, expertise/training, years of experience) shown in the public (not-logged-in) view.

### 6.3 Toast/Notification System
- A single, consistent toast component (success/error/info) used for every form submission and API response across the whole app — this is part of what "fully walkable" means in practice: every action gives feedback, nothing just silently does nothing.

### 6.4 Global Error & Loading Strategy
- Every data-fetching component has three explicit states: loading (skeleton, not a spinner-only blank screen), error (a plain-language message + retry action, never a raw error dump), and empty (a helpful message, e.g., "No facilities found nearby — try expanding your search radius," never a blank white area).
- A top-level React Error Boundary catches unhandled rendering errors and shows a friendly recovery screen instead of a white screen of death.

### 6.5 Financial-Data Sync (Sub-Tab A → Sub-Tab B, and Symptom Detector's Pop-up)
- Financial affordability data (income, expenses, insurance status) entered anywhere in the app is stored once in the Zustand global store, keyed to the current session, and read by every feature that needs it (Symptom Detector's affordability pop-up, Treatment Cost Sub-Tab B, Facility Navigator's affordability percentage).
- Per doc 06 (AI Ethics & Guardrails) and the privacy rules threaded through every other document: this data is **never persisted to the backend or any storage beyond the active session** unless the user explicitly opts in (matches your "opt-in disclaimer" in v2, and doc 06's consent-first rule) — it lives in memory for the session only by default.

---

## 7. Motion & Micro-Interaction Guidelines
- **Landing → Homepage transition:** a single, well-crafted transition (scale + fade + subtle 3D perspective shift using Framer Motion's `layoutId` or a shared-element transition) — built once, polished, never repeated elsewhere, so it stays special.
- **Form submission:** button shows an inline loading state (not a full-page spinner) so the user never wonders if their tap registered.
- **Urgency result reveal:** the urgency banner animates in with a distinct, attention-appropriate motion (a firm, fast appearance for `EMERGENCY` — no bounce or playfulness; a calmer fade for `SELF_CARE_ADVISORY`) — motion itself should reinforce the seriousness of the result, not undercut it.
- **Everything in Layer 2 beyond this:** minimal. Resist the urge to animate every card hover — premium SaaS products (Linear, Stripe) use motion sparingly and purposefully, which is precisely what makes it feel premium rather than busy.

---

## 8. Accessibility Compliance (Non-Negotiable, Inherited from Doc 07)
- **Target:** WCAG 2.1 Level AA across Layer 2 in full; Layer 1 (Landing) meets AA for text contrast and provides the reduced-motion fallback, but is not held to the same density/simplicity standard since it's a single non-task page.
- Every interactive element reachable and operable via keyboard alone (Radix primitives handle most of this automatically).
- Every icon-only button has an `aria-label` in the active language.
- Color is never the sole carrier of meaning — urgency tiers show icon + text label + color together, per doc 07.
- Minimum touch target size 44×44px throughout, including on desktop (keeps behavior consistent for users switching between devices).
- Voice input is available wherever text input is primary (Symptom Detector, any free-text field) — text is never the only path, per doc 07's voice-first principle.

---

## 9. New/Extended Backend Service Modules (Coordinated Update to Doc 03)

Your v2 concept implies three backend capabilities that doc 03 (System Architecture) does not yet define. These need to be added there; summarized here so this document is usable standalone for frontend planning.

### 9.1 Financial Affordability Engine
Takes household demographics, income, expenses, and insurance status; returns an affordability score/percentage used to personalize hospital sorting ("Most Appropriate" sort) and the affordability percentage shown on facility cards. This is deterministic calculation logic (like the OOPE calculator already specified in doc 03), not a trained model.

### 9.2 Insurance Coverage & Gap Report Generator
Takes insurance provider/plan/coverage/policy number; returns a structured report (coverage details, common rejection edge cases, claiming rules such as required bed category). Per doc 08's Track B design: this is a **retrieval** operation against a curated, verified insurance-policy-clause dataset (extending the same pattern already built for government schemes) — never a generative/hallucinated report. This means the Track B structured dataset (doc 08, §6.3) needs to be extended to include private insurance policy templates, not just government schemes, if this feature ships in Stage 1.

### 9.3 Treatment Cost Lookup & Recommendation Engine
Powers Sub-Tab B's three scenarios (budget-based recommendation / generic benchmarks / specific-hospital lookup). Reuses the Cost-Aware Routing Engine and its underlying pricing dataset (doc 03, §4.2; doc 08, §6.8's PM-JAY HBP and NLEM sources) — this is largely the same engine as the Symptom Detector's routing, exposed through a second entry point that doesn't require a symptom/urgency tier first.

### 9.4 Facility Navigator Data Service
Serves the facility list with map coordinates, PM-JAY/24-7-emergency tags, and (if the user has entered insurance info) a per-facility "accepted here: yes/no" flag. Sourced from the NHA Hospital Empanelment Module / Health Facility Registry data already identified in doc 08, §6.8.

### 9.5 Real-Time Emergency Sync (ASHA Live AI Sync) — New Architecture Component
When a user's Symptom Detector session resolves to `EMERGENCY`, their assessment + location must reach the relevant ASHA worker's dashboard **live**, not on next page load. This requires:
- A lightweight WebSocket (or Server-Sent Events, simpler to implement) channel from the backend to any logged-in ASHA worker's dashboard session, scoped to their community/region.
- On an `EMERGENCY` triage result, the Symptom Triage Service (doc 03, §4.1) publishes an event; the backend pushes it to connected ASHA dashboards in that region.
- If no ASHA worker is currently connected/online, the event is queued and delivered on their next login, with a clear "new emergency case" indicator — this must never silently drop an emergency notification.
- This is a genuinely new architectural component (doc 03 currently has no real-time layer) — flagged here so it's budgeted for, since it's more complex than the rest of the CRUD-style API surface.

---

## 10. API Contract Extensions (Coordinated Update to Doc 08)

### 10.1 Extended `/predict/triage` Request
Your Symptom Detector's input form collects more than raw text — age, gender, symptom duration, severity, and non-chronic medical history all meaningfully improve triage quality. The contract in doc 08 §9.1 should be extended, **backward-compatibly** (all new fields optional, so nothing that already calls this endpoint breaks):

```json
{
  "text": "bahut tez bukhar hai aur saans lene mein takleef ho rahi hai",
  "language": "hi",
  "age": 34,
  "gender": "female",
  "duration": "3 days",
  "severity_self_reported": "moderate",
  "medical_history": ["hypertension"]
}
```
The response shape is unchanged. Whether the trained model actually uses these extra fields (vs. just the text) is a Track A modeling decision for the AI/ML teammate to make against doc 08 — the contract just needs to carry the data through.

### 10.2 Image Upload — Explicitly Out of Scope for Stage 1
Your "image upload of the condition" is a genuinely useful feature but implies a vision-capable model, which doc 08's Track A is not currently scoped to include (it covers text/voice symptom triage only; the only vision pipeline defined anywhere in the doc set is for ASHA paper-form digitization, a different problem). Recommendation: **build the UI element now (so the layout doesn't need rework later) but keep it visually marked "coming soon" or route it to a simple "attach for your own records, not yet analyzed by AI" behavior for Stage 1** — do not silently pretend to analyze an image the backend can't actually process; that would violate the "no dummy functionality" rule in spirit even if the button technically does something. Full image-based triage is a reasonable Phase 4/on-device-engine-era feature (doc 04, Roadmap) once the multimodal model work is underway.

### 10.3 Deterministic Safety Checklist (Frontend) ↔ Rule-Based Safety Layer (Backend)
Your "Deterministic Safety Checklist" (Yes/No toggles for red-flag symptoms) is the frontend expression of the exact rule-based safety layer already specified in doc 03 §4.1 and doc 08 §2.3/§4. This is a good instinct — it makes the safety layer visible and interactive to the user rather than hidden inside the AI call. Implementation: these Yes/No answers are sent alongside the `/predict/triage` request (or as a short follow-up call) and are checked against the same red-flag rule list server-side — **the checklist answers, not the free-text symptom description, should have final override authority**, consistent with every safety rule already established across the doc set. A "Yes" on any checklist item should be capable of independently forcing an `EMERGENCY` result regardless of what the model predicted from the free text.

---

## 11. Endpoint-to-Button Inventory (Operationalizes the "Fully Walkable" Rule)

Every primary interactive element mapped to what it must actually call. Use this as a literal build/QA checklist — nothing here ships as a dummy.

| Page | Button/Action | Backend Dependency | Status |
|---|---|---|---|
| Landing | `Continue` | Client-side route transition only | No backend needed |
| Landing | `See how it works` | Routes to `/how-it-works` (static content) | No backend needed |
| Symptom Detector | Submit symptom form | `POST /predict/triage` (extended, §10.1) | New/extended |
| Symptom Detector | `Nearby Medical Facility` | `GET /facilities?symptom_category=&urgency=&location=` (§9.3/9.4) | New |
| Symptom Detector | Financial Affordability pop-up submit | `POST /financial-affordability` (§9.1) | New |
| Symptom Detector | Skip pop-up | Client-side only, falls back to basic facility list | No backend needed |
| Cost Check Sub-Tab A | Submit financials | `POST /financial-affordability` (shared with above) | New |
| Cost Check Sub-Tab B | Search cost | `POST /treatment-cost-lookup` (§9.3) | New |
| Cost Check Sub-Tab B | "Recommendations for other options?" | `GET /treatment-cost-alternatives` (§9.3) | New |
| Insurance Sub-Tab A | `Generate Detailed Coverage & Gap Report` | `POST /insurance-report` (§9.2, Track B retrieval) | New |
| Insurance Sub-Tab B | Scheme search/match | `POST /predict/scheme-match` (already defined, doc 08 §9.2) | Existing contract |
| Facility Navigator | Filter toggles (PM-JAY/24-7) | `GET /facilities` with query params (§9.4) | New |
| Facility Navigator | Map pin interactions | `GET /facilities` (map coordinates included) | New |
| ASHA (public) | `Login` / `Register` | `POST /auth/login`, `POST /auth/register` (§6.2) | New |
| ASHA Dashboard | `Register New Patient` | `POST /asha/patients` | New |
| ASHA Dashboard | View registration history | `GET /asha/patients` | New |
| ASHA Dashboard | Emergency Action Board | WebSocket/SSE channel (§9.5) + `GET /asha/emergencies` for initial load | New — real-time |

Anything in this table marked "New" does not yet exist in the current API surface and must be built alongside the frontend, per your explicit rule that no button ships without a real endpoint behind it.

---

## 12. Coordinated Updates Required in Other Documents

This document creates the following follow-up edits, applied alongside this spec:
- **Doc 02 (Tech Stack):** lock frontend framework to React + Vite (remove the "or Next.js" option); add the production frontend libraries from §3 above (TanStack Query, Zustand, React Hook Form + Zod, Framer Motion, Leaflet, shadcn/ui).
- **Doc 03 (System Architecture):** add the four new service modules from §9 and the real-time sync architecture from §9.5.
- **Doc 08 (AI Training System):** extend the `/predict/triage` contract per §10.1; note that Track B's scheme dataset may need an insurance-policy-clause extension per §9.2 if the Insurance Checker ships in Stage 1.
- **Doc 07 (App & Website Design):** remains the source of truth for design *principles*; this document is the source of truth for the *detailed, page-by-page production spec* that implements those principles. Doc 07 is not superseded, just made concrete here.

A note on the map provider decision (Leaflet/OpenStreetMap vs. Google Maps/Mapbox, §3): OpenStreetMap has no usage cost and no API key requirement, which matters for a hackathon budget, at the cost of slightly less polished tile styling and no built-in turn-by-turn directions (only routing to an external maps app link). If the team later has budget/sponsor credits for Mapbox, swapping is a contained change (the Facility Navigator's map component is the only place this touches) — not a reason to block the Stage 1 build now.
