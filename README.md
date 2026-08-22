<div align="center">
  <img src="https://raw.githubusercontent.com/Hack-master22/Swasthya-Setu-Ai/main/frontend/public/logo.jpg" alt="Swasthya Setu AI Logo" width="120" />
  <h1>Swasthya Setu AI</h1>
  <p><strong>Complete Regional Multilingual Healthcare Support</strong></p>
  
  <p>
    <a href="#features"><img src="https://img.shields.io/badge/Features-AI%20Triage-34f5b1?style=for-the-badge&logo=openai&logoColor=black" alt="Features"></a>
    <a href="#tech-stack"><img src="https://img.shields.io/badge/Tech_Stack-FastAPI%20%7C%20React-4ee6f0?style=for-the-badge&logo=fastapi&logoColor=white" alt="Tech Stack"></a>
    <a href="#installation"><img src="https://img.shields.io/badge/Setup-Zero%20DevOps-0a121e?style=for-the-badge&logo=linux&logoColor=white" alt="Setup"></a>
  </p>
</div>

---

## ?? Vision & Impact
**Swasthya Setu AI** is an advanced, AI-driven healthcare navigation platform designed to bridge the severe infrastructure gap in regional and rural healthcare systems. 

By combining a **Vision-LLM Cascade**, **OSINT Web Scraping**, and **Offline-first Architecture**, the platform provides clinical-grade symptom triage, exact real-world cost estimations, and direct routing to local community health workers (ASHA). It is designed to be fully resilient—falling back gracefully when network connectivity drops or AI endpoints timeout.

---

## ?? Core Features

### 1. AI Symptom Triage (Vision + LLM Cascade)
- **Multimodal Analysis:** Patients can upload images (e.g., rashes, wounds) alongside text symptoms.
- **Fail-Safe Cascade Routing:** Routes requests through Gemini 1.5 Flash ?' Groq (Llama 3.2 Vision) ?' NVIDIA (Llama 3.1) using litellm. If one API rate-limits or times out, it instantly falls back to the next.
- **Deterministic Safety Gate:** AI predictions are strictly validated against a deterministic red-flag checklist to prevent hallucinations in critical emergency scenarios.

### 2. OSINT Cost Estimation Engine
- **Real-Time Data Scrape:** Instead of relying on hallucinated LLM pricing, the backend utilizes duckduckgo_search wrapped in strict async timeouts to scrape peer-reviewed medical data (NIH, Mayo Clinic).
- **Financial Profiler:** Analyzes a patient's disposable income against treatment costs to calculate a precise "Affordability Percentage".

### 3. Glassmorphism UI & 3D Interactive Maps
- **Premium Frontend:** Built with React, Tailwind CSS, and Framer Motion for buttery-smooth animations, liquid-glass cards, and 3D hover physics.
- **Zero-Dependency Mapping:** Utilizes **Pigeon Maps** with OpenStreetMap and ArcGIS satellite tiles. Completely free of Google Maps billing limits.

### 4. ASHA Control Room (Community Desk)
- **Real-Time Sync:** A dedicated dashboard for local Accredited Social Health Activists (ASHA).
- **Emergency Dispatch:** Level-4 critical triage cases are immediately pinged to the local ASHA worker's board for physical intervention.

---

## ???> Tech Stack

| Domain | Technology | Description |
|--------|------------|-------------|
| **Frontend** | React, Vite, Tailwind CSS | Compiled to a single hyper-optimized HTML file via ite-plugin-singlefile. |
| **Animation**| Framer Motion | Deep glassmorphism, 3D cursor physics, spring-based comboboxes. |
| **Backend** | FastAPI, Python 3.12 | Fully asynchronous API architecture with strict slowapi rate limiting. |
| **Database** | SQLite & iosqlite | Zero-setup local database. Instantly scalable to PostgreSQL via Alembic. |
| **AI Routing**| litellm | Standardized LLM API gateway for Gemini, Groq, and NVIDIA. |

---

## ?? Installation & Quick Start

Swasthya Setu AI is engineered for **Zero-DevOps setup**. You do not need Docker, PostgreSQL, or Redis to run this locally.

### 1. Clone the Repository
\\\ash
git clone https://github.com/Hack-master22/Swasthya-Setu-Ai.git
cd Swasthya-Setu-Ai
\\\

### 2. Backend Setup
\\\ash
cd backend
python -m venv .venv
source .venv/bin/activate  # (On Windows: .venv\Scripts\activate)
pip install -r requirements.txt
\\\
Create a .env file in the ackend/ directory:
\\\env
# Optional APIs for advanced features:
GEMINI_API_KEY=your_key
GROQ_API_KEY=your_key
NVIDIA_API_KEY=your_key
\\\
Start the FastAPI server:
\\\ash
uvicorn app.main:app --reload --port 8000
\\\

### 3. Frontend Setup
Open a new terminal window:
\\\ash
cd frontend
npm install
npm run dev
\\\
Visit http://localhost:5173 in your browser.

---

## ?? Architecture & Resilience (The "Professor Pitch")

*Why does this architecture stand out?*
Most AI healthcare projects rely on a single point of failure (e.g., OpenAI API). Swasthya Setu AI implements an **Adversarial Resilience Strategy**:
1. **Strict Pydantic Boundaries:** All AI output is aggressively typed and sanitized. Corrupted JSON from an LLM results in a swift HTTP 422, rather than a server-crashing 500.
2. **Network Timeouts:** The OSINT cost-scraper is bounded by a strict 3.5s syncio.wait_for lock. If the scrape stalls, it is gracefully swallowed, allowing the frontend to seamlessly render local offline estimates.
3. **Graceful UI Degradation:** If the maps tile server goes offline, Pigeon Maps catches the failure and renders a styled SVG fallback overlay without crashing the React tree.

---
*Built with passion for accessible, scalable healthcare tech.*
