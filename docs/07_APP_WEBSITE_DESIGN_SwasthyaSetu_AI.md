# App & Website Design Document
## SwasthyaSetu AI — Web (Stage 1) and Mobile App (Stage 2)

---

## 1. Design Philosophy

The design must work for a user who may have **low literacy, no prior smartphone-app experience, and low trust in digital tools**. Every design decision is filtered through one question: *"Would this work for someone who has never used an app before, in their own language, with shaky hands and a cracked-screen phone?"*

### Core Design Principles
- **Voice-first, text-optional** — never require typing as the only path.
- **Icon-driven navigation** — minimize reliance on written labels; pair every icon with a short native-language label.
- **High contrast, large touch targets** — accessible for older users and low-end screens.
- **One task per screen** — no dense forms; break every workflow into short, linear steps.
- **Immediate, plain-language feedback** — especially for urgency/emergency results, shown in large text and read aloud.
- **Trust-building visual language** — use recognizable government-scheme branding cues (PM-JAY, PMBJP, AMRIT) so users recognize the system is connected to trusted public infrastructure, not an unfamiliar private app.

---

## 2. Website Design (Stage 1 — Build First)

### 2.1 Site Map
```
Home / Language Select
  ├── Patient Flow
  │     ├── Symptom Input (voice/text)
  │     ├── Urgency Result Screen
  │     ├── Routing Recommendation (facility/pharmacy + cost estimate)
  │     └── Facility Detail (location, PM-JAY status, estimated cost breakdown)
  ├── ASHA Worker Flow
  │     ├── Login / Worker ID
  │     ├── Form Photo Capture
  │     ├── Field-by-Field Voice Confirmation
  │     └── Record Saved Confirmation
  └── Admin Dashboard (restricted access)
        ├── Aggregate Triage Volume
        ├── Urgency-Tier Distribution
        └── Routing Outcomes by Region
```

### 2.2 Key Screens — Patient Flow

**Screen: Language Select**
- Large flags/scripts, tap-to-select, no scrolling required for the MVP language set.

**Screen: Symptom Input**
- Central large microphone button (primary action) with a visible text-input fallback below.
- Real-time transcription shown as the user speaks, so they can confirm the system heard them correctly.

**Screen: Urgency Result**
- Color-coded, large-text result (red = emergency, yellow = consult soon, green = self-care advisory).
- Plain-language explanation of *why* ("You mentioned [X], which needs prompt attention").
- For `EMERGENCY`: full-screen takeover with emergency contact/nearest facility, no other navigation options competing for attention.

**Screen: Routing Recommendation**
- Ranked list of 1–3 facility/pharmacy options.
- Each card shows: facility name, type, distance/location, PM-JAY empanelment badge (if applicable), and **estimated cost** in large, bold currency text — this is the differentiator screen and should be the most visually prominent element in the entire flow.

### 2.3 Key Screens — ASHA Worker Flow

**Screen: Form Photo Capture**
- Camera-first interface with an overlay guide showing how to align the paper form.

**Screen: Field-by-Field Voice Confirmation**
- One detected field at a time (e.g., "Mother's Name") with a microphone button to speak the value; shows the transcribed text for confirmation/edit before moving to the next field.
- Progress indicator (e.g., "Field 3 of 8") to manage cognitive load.

**Screen: Record Saved Confirmation**
- Simple, reassuring confirmation with a summary of what was captured, plus an explicit "Confirm & Save" action (human-in-the-loop requirement from the AI Ethics doc).

### 2.4 Key Screens — Admin Dashboard
- Standard data-dashboard patterns (cards + charts via Recharts): total sessions, urgency-tier breakdown, top routing destinations, regional heat map (if location data is available).
- Explicitly **no individual patient records** are ever rendered here (see AI Ethics & Guardrails §5).

### 2.5 Visual/Design System (Web)
| Element | Guidance |
|---|---|
| Color | High-contrast palette; reserve red/yellow/green strictly for urgency signaling (not decorative use elsewhere, to avoid confusion) |
| Typography | Large base font size (≥18px equivalent); native-script web fonts tested for legibility (e.g., Devanagari, Bengali) |
| Iconography | Simple, universally recognizable icons (microphone, hospital cross, pharmacy/pill, person) paired with native-language labels |
| Layout | Single-column, mobile-responsive-first even on desktop, since most real users will access via a mobile browser |
| Motion | Minimal; avoid animations that could confuse or slow down low-bandwidth connections |

---

## 3. Mobile App Design (Stage 2 — Later Phase)

The mobile app reuses the same information architecture and visual system as the website, with additions specific to offline/on-device operation and ASHA field use.

### 3.1 Additions Over the Web Design
- **Offline status indicator:** a persistent, unobtrusive banner/icon showing "Working Offline — will sync when connected" vs. "Synced," so ASHA workers always know their data's sync state.
- **ASHA Kiosk Mode:** a locked-down, simplified navigation shell (fewer options visible, larger buttons) specifically for the 2-hour onboarding target — strips away anything not essential to the daily digitization workflow.
- **On-device processing indicator:** subtle visual cue (e.g., a small "on-device" badge) when the local AI engine is handling a request, reinforcing the privacy-by-design principle to the user.
- **Local storage/sync management screen:** for ASHA workers to see pending unsynced records and manually trigger a sync attempt if needed.

### 3.2 Where the Local (On-Device) AI Engine Fits the Design
Per the team's direction, the on-device engine is a **Phase 4 (later) build**, but the app's design already reserves its place in the architecture:
- The Symptom Input and Form Capture screens are designed identically whether the request is served by a cloud LLM (early Stage 2) or the on-device engine (later Stage 2) — the user-facing design does not change, only the backend/on-device routing behind it (see System Architecture §8, pluggable AI-engine design).
- This means design work done now for the website is **not throwaway work** — it is the design system the app will inherit almost unchanged.

### 3.3 Design Consistency Table (Web → App)

| Component | Web (Stage 1) | App (Stage 2) | Reused? |
|---|---|---|---|
| Language select | ✅ | ✅ | Fully reused |
| Symptom input (voice/text) | ✅ | ✅ + offline indicator | Reused + extended |
| Urgency result screen | ✅ | ✅ | Fully reused |
| Routing/cost recommendation | ✅ | ✅ | Fully reused |
| ASHA form capture flow | ✅ (server-side simulation) | ✅ (on-device, Phase 4) | Reused UI, backend swapped |
| Admin dashboard | ✅ | Optional (web-based, likely stays web-only) | Partial |
| Kiosk Mode | N/A | ✅ New | New for app |
| Sync status UI | N/A | ✅ New | New for app |

---

## 4. Accessibility Checklist (Both Web & App)
- [ ] Every primary action has a voice alternative to typing
- [ ] All critical text is paired with an icon
- [ ] Color is never the sole carrier of meaning (urgency tiers also use text labels + icons, not color alone)
- [ ] Minimum touch target size respected throughout
- [ ] Emergency screens are single-purpose with no distracting navigation
- [ ] All UI strings pass through the i18next/localization layer — no hardcoded English strings in critical flows

---

### 3.4 Note on the Trained AI Model's Invisibility to Design
Whether a symptom or scheme-matching request is answered by the hosted trained model (Stage 1/early Stage 2) or the on-device model (later Stage 2), the screens in §2.2–2.3 do not change — the trained model always returns the same `symptom_category` / `suggested_urgency` / `matched_schemes` shape (see AI Training System doc §5.2), and the UI only ever renders the final, rule-layer-approved result. Designers do not need to build separate states for "AI answered this" vs. "on-device model answered this" — only for confidence-driven fallback states (e.g., "showing all matching options" when Track B confidence is low), which should be designed as a normal, non-alarming list view rather than an error state.

---

*This document should be read alongside the PRD (for the personas this design serves), the Roadmap (for when each design element is built), and the AI Training System document (for what the trained model returns to the UI layer).*
