# Tech Stack Documentation
## SwasthyaSetu AI

---

## 1. Guiding Principle

The stack is chosen for **two sequential targets**:
- **Stage 1 (Now):** A web application — fast to build, fast to demo, no hardware constraints. This is the prototype through which *all workflows* (triage, routing, ASHA digitization, admin analytics) are validated end-to-end.
- **Stage 2 (Later):** A React Native mobile app with an on-device edge AI engine for 2GB RAM, low-storage smartphones — the real deployment target for rural users and ASHA workers.

The architecture is designed so that Stage 1's core logic (triage rules, routing engine, cost calculator) is **portable** into Stage 2 with minimal rewrite — business logic lives in a shared, framework-agnostic layer wherever possible.

---

## 2. Stage 1 — Website Prototype Stack

### 2.1 Frontend (Web)
| Layer | Technology | Why |
|---|---|---|
| Framework | **React.js** (or Next.js for SSR + routing) | Same component mental model as React Native — eases the eventual Stage 2 port; large ecosystem; fast prototyping |
| Styling | **Tailwind CSS** | Rapid, consistent, accessible UI; easy to enforce large touch targets and high-contrast, icon-driven design for low-literacy users |
| State Management | **React Context / Zustand** | Lightweight; avoids over-engineering for an MVP |
| Voice Input (browser) | **Web Speech API** (with fallback to text) | Native browser support for speech-to-text; used to simulate the voice-first UX before the on-device engine exists |
| Internationalization | **i18next** | Manages multi-language UI strings (Hindi, Bengali, Hinglish/Banglish labels) |
| Charts/Dashboard | **Recharts** | For the admin analytics dashboard (aggregated triage/routing stats) |

### 2.2 Backend (Web API)
| Layer | Technology | Why |
|---|---|---|
| API Framework | **FastAPI (Python)** | Async-first, high performance, auto-generated OpenAPI docs, and — critically — the *same framework the team's research doc identifies as production-ready for the eventual mobile backend*, ensuring continuity into Stage 2 |
| AI/NLP Orchestration | **FastAPI service layer wrapping an LLM API** (e.g., a hosted model via API) for symptom understanding, **combined with a rule-based clinical triage layer** for safety-critical urgency classification | AI augments language understanding; a deterministic rules layer makes the final urgency call (see AI Ethics & Guardrails doc) |
| Database | **PostgreSQL** | Relational integrity for scheme/facility/pricing datasets and structured ASHA records; easy to migrate seed data from into SQLite for the mobile app later |
| Caching | **Redis** (optional, for repeated routing queries) | Speed for facility/pricing lookups |
| Authentication | **OAuth 2.0 / JWT** | Consistent auth strategy across web and future mobile app |
| File/Image Handling | **Pillow / OpenCV (Python)** for form-image field detection prototype | Simulates the on-device vision pipeline server-side for the web demo |
| Trained AI Model Serving | **FastAPI microservice(s)** wrapping the trained Track A (Symptom Triage) and Track B (Scheme Matching) models, exposing `/predict/triage` and `/predict/scheme-match` | Keeps the trained-model workstream (owned by the AI/ML teammate) decoupled from the main product backend — see AI Training System doc §5 for the full contract |

### 2.2.1 AI/ML Training Stack (Separate Workstream)
| Layer | Technology | Why |
|---|---|---|
| Model Development | **Hugging Face Transformers** | Fine-tuning/prompting for the Symptom Triage NLU model (Track A) |
| Lightweight Fallback Classifier | **scikit-learn** | Fast, cheap classical classifier as a fallback path to the LLM-based triage model |
| Retrieval/Embeddings | **sentence-transformers + FAISS** | Powers the Scheme Eligibility & Cost-Matching retrieval model (Track B); FAISS chosen for local/offline-capable vector search, consistent with offline-first principles |
| Experiment/Version Tracking | **MLflow** (or a versioned artifact + README log at hackathon scale) | Every deployed model carries a version ID, dataset snapshot reference, and evaluation report |
| On-Device Export (Stage 2) | **ONNX / ONNX Runtime Mobile** (or the runtime required by the chosen on-device model) | Converts trained models into a quantized, mobile-deployable format meeting the 2GB RAM / <100MB targets |

> Full detail — dataset requirements, training approach, evaluation bar, official government data sources with download links, and the exact API contract connecting trained models to the main system — lives in the dedicated **AI Training System** document.

### 2.3 Infrastructure (Web Prototype)
| Layer | Technology | Why |
|---|---|---|
| Hosting (Frontend) | **Vercel / Netlify** | Zero-config deploys, ideal for hackathon iteration speed |
| Hosting (Backend) | **Render / Railway / AWS EC2 (free-tier friendly)** | Simple FastAPI deployment |
| Database Hosting | **Supabase / Neon (managed Postgres)** | Fast setup, generous free tiers for prototypes |
| Version Control | **Git + GitHub** | Standard SIH submission requirement |

---

## 3. Stage 2 — Mobile App & Edge AI Stack (Future Phase, Architected For Now)

> Per team direction: this layer is **deferred** in build order but must be reflected in architecture decisions today so Stage 1 doesn't require a rewrite.

| Layer | Technology | Why |
|---|---|---|
| App Framework | **React Native** | Cross-platform, near-native performance, shares component logic/patterns with the Stage 1 React web app |
| Alternative (native) | **Kotlin + MVVM** | Considered for maximum resource efficiency on very old Android versions if React Native overhead proves too heavy on 2GB RAM devices |
| Local Database | **SQLite (via Room on native / WatermelonDB or op-sqlite on RN)** | Offline-first structured storage of patient/ASHA records |
| Background Sync | **Android WorkManager** (via native module) | Encrypts and pushes cached data only when connectivity is detected |
| On-Device AI Engine | **Compact multimodal model (e.g., a 4B-parameter class model such as Gemma 3n)** running via an on-device inference runtime | Enables offline vision (form field detection) + voice (native-language transcription) with zero cloud dependency, per the ASHA-G reference pattern in the research |
| Local Encryption | **AES-256** | Protects locally cached patient data on shared family devices |
| Auth | **OAuth 2.0** | Consistent with web backend |
| Low-Bandwidth Messaging | **SMS Gateway API / WhatsApp Business API / IVR provider** | Medication adherence nudges; USSD as a stretch goal for zero-install access |

---

## 4. Why This Stack Fits the Constraints

| Constraint (from research) | Stack Response |
|---|---|
| 2GB RAM, 100MB app size target devices | React Native (not Flutter's larger runtime footprint in some configs) or native Kotlin fallback; on-device model chosen for selective parameter activation (small footprint) |
| Rural connectivity is asymmetric | Offline-first local DB (SQLite/Room) + WorkManager sync mirrors the CHIP/Sakhi platform pattern cited in research |
| Data privacy on shared devices | AES-256 local encryption + OAuth 2.0, matching the "privacy by design" principle |
| Team is building web first | FastAPI + React chosen specifically because both have first-class, near-identical mobile equivalents (FastAPI stays the backend; React → React Native), minimizing Stage 2 rework |

---

## 5. Explicitly Deferred / Not Used at MVP

- **On-device edge AI model** — deferred to Stage 2; Stage 1 simulates the same UX via a server-side LLM + rules layer.
- **USSD integration** — stretch goal, not MVP.
- **Native Kotlin build** — fallback only if React Native performance testing on target devices fails.
- **Payment/insurance transaction processing** — out of scope entirely (see PRD §5.3).

---

## 6. Summary Table

| Component | Stage 1 (Website) | Stage 2 (App) |
|---|---|---|
| UI Framework | React / Next.js + Tailwind | React Native |
| Backend | FastAPI | FastAPI (shared) |
| Database | PostgreSQL | SQLite / Room (local) + Postgres (central sync) |
| AI Layer | Cloud LLM API + rule-based triage | On-device compact multimodal model + same rule-based triage |
| Auth | OAuth 2.0 | OAuth 2.0 |
| Sync | N/A (always online) | WorkManager background sync |
| Encryption | TLS in transit | AES-256 at rest + TLS in transit |

---

*This document should be read alongside the System Architecture document for how these components interact, and the AI Training System document for the full model training and integration spec.*
