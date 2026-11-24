import os

docs_dir = r"c:\Users\user\projects\SwasthaSetu Ai\docs"

# We are going to patch the PRD and Architecture to resolve the logical contradictions
patch_prd = """
---
## SYSTEMIC PATCH: Logical & Reasoning Corrections
*(Added via Deep Logical Gap Analysis)*

### 1. The Aadhaar/Eligibility Paradox (Resolved)
**Logical Gap:** We claimed we can do "Deterministic Scheme Matching" for PM-JAY, but we also claim we don't use Aadhaar for privacy. You cannot verify PM-JAY without an Ayushman Card or Aadhaar query to the SECC database.
**Correction:** The feature is hereby redefined as a **"Presumptive Eligibility Simulator."** It calculates mathematical probability of eligibility based on user-inputted socio-economic demographics (income, occupation, caste) rather than claiming a legally binding deterministic match.

### 2. The Persona Collision (Resolved)
**Logical Gap:** The pitch claims "Meena (a farm laborer) uses the app," but we also claim the app is an "ASHA Worker Tool." Rural farm laborers rarely have smartphones or internet literacy. 
**Correction:** The primary user persona is officially the **ASHA Worker operating on behalf of the patient (Assisted Mode).** Patient self-service is a secondary fallback. 

### 3. The Offline Triage Contradiction (Resolved)
**Logical Gap:** We claim offline facility routing, but the AI Triage cascade requires an internet connection (Gemini/Groq). If they are offline, they can't get triaged to know *where* to route.
**Correction:** If the device detects a zero-connectivity state, the app bypasses the LLM cascade entirely. It relies strictly on the local 41-keyword Safety Gate and a local offline decision-tree to route to the nearest PHC.
"""

patch_arch = """
---
## SYSTEMIC PATCH: The Latency Paradox
*(Added via Deep Logical Gap Analysis)*

### 1. <3 Second Fallback Contradiction (Resolved)
**Logical Gap:** Claiming a `<3 second` triage time is a statistical impossibility if the system hits a timeout and falls back to Stage 2 (Groq) or Stage 3 (NIM) of the cascade.
**Correction:** The `<200ms` SLA applies ONLY to the deterministic Safety Gate. The LLM Triage Cascade is strictly designated as an **Asynchronous Process**. The UI must not use a spinning loader; it must accept the request, allow the user to continue using the app, and deliver the triage result via an in-app notification when the cascade completes.
"""

def append_to_file(filename, content):
    filepath = os.path.join(docs_dir, filename)
    if os.path.exists(filepath):
        with open(filepath, 'a', encoding='utf-8') as f:
            f.write(content)
            print(f"Patched {filename}")
    else:
        print(f"File {filename} not found.")

append_to_file("02_PRD.md", patch_prd)
append_to_file("03_SYSTEM_ARCHITECTURE.md", patch_arch)
