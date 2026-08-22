# SwasthyaSetu AI: Frontend Concept Overview (v2)

*This document captures the updated, premium frontend design requirements step-by-step.*

**Tech Stack Rule:** The entire frontend will be built in one consistent framework (React + Vite). No mixing languages or frameworks across pages.
**Strict Interactivity Rule:** The website must be "fully walkable." No dummy or placeholder buttons are allowed anywhere. Every single button must have a functional endpoint behind it (we will build out any missing backend endpoints later to ensure this).

---

## 0. Global Features
**Universal Language Switcher:**
- Located in the top header/navigation bar across the entire website.
- A dropdown selecting between English and 7 regional languages.
- **Behavior:** Switching the language instantly translates *every single text element* on the website to the chosen language. 
- It also supports native language typing in all input boxes (e.g., users can type their symptoms in Hindi directly).

---

## 1. Landing Page
**Vibe/Aesthetic:** 3D visualistic, glassmorphism (premium, professional look).

**UI Elements:**
- **Logo & Title:** Central placement (Logo asset to be provided).
- **Description:** Short tagline/description below the project name.
- **Primary Action:** `Continue` button. Clicking this triggers a smooth, 3D dynamic transition into the main Homepage.
- **Secondary Action:** `See how it works` button (placeholder for now; routes to an explainer page to be designed last).

---

## 2. Homepage (The Central Hub)
**Header (Top Navigation):**
- **Top Left:** Project Logo followed by Project Name.
- **Top Right/Center:** Global Language Switcher.
- **Tabs/Links:** 
  1. Home
  2. AI Symptom Detector
  3. Treatment Cost and Financial Availability
  4. Insurance Policy and Government Scheme Checker
  5. Facility Navigator
  6. ASHA Health Worker

**Main Content Area:**
Acts as a dashboard summarizing the core features. (Specific widgets and hyperlinks will be finalized once all individual pages are mapped out).

---

## 3. AI Symptom Detector Tab
**Layout:** A side-by-side (Two-Column) layout for maximum desktop/tablet efficiency, stacking vertically on mobile.

### Left Column: Input Form
- **Heading:** Description of what the system does.
- **Voice Input Placeholder:** Reserved space/button above the text box for future voice-to-text integration.
- **Primary Symptom Box:** A large text area for users to write their symptoms (supports regional language typing).
- **Patient Details (Dropdowns/Scrolls):**
  - Age
  - Gender
  - Duration of symptoms
  - Severity level
- **Medical History:** Input for non-chronic or pre-existing conditions for better AI assessment.
- **Image Upload:** A button to upload photos of the condition/severity.
- **Deterministic Safety Checklist:** A high-priority checklist of emergency/concerning situations (e.g., "Are you experiencing chest pain?") with simple `Yes` / `No` toggles.

### Right Column: Assessment Results & Financial Routing
- **Dynamic Result Display:** Populates after the form is submitted.
- **Urgency Warning:** If the triage result is SEVERE, SERIOUS, or EMERGENCY, a massive, highly visible warning is displayed.
- **The "Nearby Medical Facility" Flow (For Severe/Emergency Cases):**
  - A prominent `Nearby Medical Facility` button appears.
  - Clicking it triggers a **Financial Affordability Pop-up**.
  - **Inside the Pop-up (Fields taken from Left-Hand Side of Reference Design):**
  - Household Demographics & Income
  - Monthly Expenses
  - Existing Government Insurance (e.g., PM-JAY status)
  - *(Note: Household Cash Flow and Priority Help Protection sections are explicitly excluded to simplify the flow).*

  **Path A: User Fills Out the Pop-up**
  - The hospital list unlocks advanced filtering and personalization.
  - **Sort Options:** Lowest Price, Best Quality, and **Most Appropriate** (a smart algorithm balancing low price + best quality).
  - Each hospital card shows:
    - Quality Rating & Cost Rating.
    - A personalized **Affordability Percentage** *(Note: Calculated via backend using the hidden cashflow logic from the reference site's right column).*
    - Expected cost of treatment.

  **Path B: User Skips/Does Not Fill Out the Pop-up**
  - Displays the basic nearby facility list.
  - No personalized affordability percentage or advanced detailing.
  - Hospital quality ratings remain visible.
  - Basic sorting is available based purely on the maximum expected treatment cost.

## 4. Treatment Cost & Financial Availability Tab
**Layout:** This dedicated page is split into two connected Sub-Tabs.

### Sub-Tab A: Financial Availability (Optional)
- **Form Fields:** Uses the exact same financial inputs from the left-hand side of the reference component (Demographics, Income, Expenses, Insurance).
- **Dashboard:** Because this is a full page, it also displays the complete visual dashboard (the right-hand cashflow calculations) so the user sees their full financial status.
- **Opt-In Disclaimer:** A clear notice stating: *"Filling this out is not compulsory. However, if you do, our system will generate a highly accurate, personalized hospital recommendation based exactly on your financial condition."*
- **Data Sync:** Data entered here instantly and invisibly syncs to Sub-Tab B.

### Sub-Tab B: Treatment Cost Check-up
- **Search Inputs:**
  - Disease or Treatment Name
  - Location / City
  - Severity Level
  - Specific Hospital Name *(Optional)*
- **Important Disclaimer:** Must prominently display: *"This cost is mathematically calculated based on research. It is an approximate expected cost, not the actual or exact final cost of the treatment."*

**Routing Logic Based on Inputs:**
- **Scenario 1: User provided Financials (Sub-Tab A) + NO Specific Hospital:**
  - The system analyzes their budget and outputs the absolute best hospital recommendation that balances **highest treatment quality** with **financial affordability**.
- **Scenario 2: User skipped Financials + NO Specific Hospital:**
  - The system outputs generic benchmarks (Lowest, Average, Best Cost) and lists standard hospitals based on raw pricing and general ratings.
- **Scenario 3: User enters a Specific Hospital Name:**
  - The system bypasses general recommendations and *only* shows the expected cost and rating for that one specific hospital.
  - At the bottom, a button appears: *"Do you want recommendations for other cost-effective treatment plan options?"*
  - If clicked, it reveals the optimized list of alternative hospitals they can better afford.

## 5. Insurance Policy & Government Scheme Checker Tab
**Layout:** Split into two distinct, non-interlinked Sub-Tabs.

### Sub-Tab A: Insurance Policy Checker
- **Form Inputs:**
  - Insurance Provider Name
  - Insurance Name / Plan Name
  - Insurance Type
  - Insurance Coverage (Sum Insured amount)
  - Insurance Number / Policy Number
- **Primary Action:** A button labeled `Generate Detailed Coverage & Gap Report`.
- **Output Report Requirements:**
  - Complete details of the insurance.
  - **Cons & Edge Cases:** Specific critical situations or edge cases where claims are frequently rejected or canceled.
  - **Claiming Rules:** Exact guidelines on what facilities are required to claim the insurance (e.g., specific hospital bed categories the user *must* select to avoid proportionate deductions).

### Sub-Tab B: Government Scheme Finder
- **Base Design:** Taken directly from the Scheme Discovery component in the reference website.
- **Upgrades:** Fine-tuned and advance-modified to be more interactive, highly professional, and detailed.
- **Functionality:** Fully walkable (like the rest of the site), ensuring users can genuinely find and match their eligibility to real schemes.

## 6. Facility Navigator Tab
**Base Design:** Pull the core layout from the reference website's Facility Navigator but advance-modify it with higher detail and interactivity.

**Advanced Features & Filters:**
- **Dynamic Tags/Filters:** Must include clear, filterable tags for `PM-JAY Cashless` and `24/7 Emergency` facilities.
- **Personalized Insurance Matching:** If the user previously inputted their specific insurance name/policy in the system, each hospital card must dynamically indicate whether that specific insurance is accepted there (e.g., "HDFC Ergo: Accepted").
- **Map & Location Integration:**
  - A real interactive map showing the locations of the facilities.
  - Requires backend/frontend integration with a real Map API (e.g., Google Maps / Mapbox) to fetch exact coordinates, real-time nearby facility lists, and provide turn-by-turn directions.

## 7. ASHA Health Worker Tab
**Base Design:** Structured using the clean reference website dashboard, but expanded into two distinct states based on login status.

### State 1: Public View (Not Logged In)
- **Use Case:** When a normal citizen visits this tab.
- **Display:** Shows a directory of nearby ASHA workers.
- **Details:** Includes the ASHA worker's name, expertise/training, and years of experience.
- **Actions:** Buttons for an ASHA worker to `Login` or `Register` to access the restricted system.

### State 2: ASHA Worker Dashboard (Logged In)
Once authenticated, the UI switches to a comprehensive frontline worker dashboard:
- **Register New Patient:** A form for the ASHA worker to digitally register a new patient in their village.
- **Community Registration History:** A log/report section where the worker can view all the patients they have registered and their past reports.
- **Emergency Action Board:**
  - Located directly below the registration history.
  - **Live AI Sync:** If any user in the community uses the *AI Symptom Detector* (Tab 3) and hits one of the 4 critical/severe emergency categories, their complete symptom profile and location are instantly routed to this Emergency board.
  - **Action:** The ASHA worker can view the full AI assessment and exact location of the critical patient so they can physically go to them to provide immediate medical guidance or facilitate an ambulance.

---
*(End of Concept Overview)*
