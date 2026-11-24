import os

docs_dir = r"c:\Users\user\projects\SwasthaSetu Ai\docs"

patch_frontend = """
---
## SYSTEMIC PATCH: Frontend Risk Mitigations
*(Added via Unified Context Analysis)*

### 1. Mixed-Intent State Handling
If the Intent Classifier routes a query to both the Symptom and Cost pipelines, the backend will return a parallel payload. The frontend MUST implement conditional rendering blocks to handle the `mixed` intent state without crashing:
- Render the Clinical Triage card on top (priority).
- Render the Cost Estimate card directly below.
- Do NOT attempt to map financial arrays into clinical text components.

### 2. Financial Stale-State Warning
Because the financial ETL runs offline, prices are not real-time. To prevent legal liability, the UI MUST dynamically extract the `last_verified_date` from the payload and render a visible badge: *"Estimated cost as of [Date]. Confirm at facility."*

### 3. Offline Referral "Pending Sync" UI
When an ASHA worker creates a referral in a zero-connectivity zone, the UI MUST instantly render a "Pending Sync" (yellow cloud) icon next to the patient record. This icon must remain until a successful 200 OK is received from the server.
"""

patch_arch = """
---
## SYSTEMIC PATCH: Offline Referral Sync & Timestamp Reconciliation
*(Added via Unified Context Analysis)*

### 1. Chronological Integrity
When ASHA workers operate offline, referrals are stored locally. To prevent chronological corruption on the District Hospital dashboard when devices finally sync:
- The mobile client MUST generate a `client_created_at` (ISO 8601 UTC) timestamp at the exact moment of creation.
- The server MUST use `client_created_at` for ordering medical histories, but add a `server_synced_at` timestamp for audit logging.

### 2. Idempotency Generation
To prevent duplicate referrals if a poor connection drops the sync acknowledgment, the client MUST attach an Idempotency Key in the header:
`Idempotency-Key: SHA256(worker_id + client_created_at + patient_id)`
"""

patch_data = """
---
## SYSTEMIC PATCH: Financial Schema Requirements
*(Added via Unified Context Analysis)*

### 1. Offline ETL Recency Tracking
To support the frontend's Stale-State Warning, every row in the `government_costs` table MUST contain:
- `last_verified_date` (TIMESTAMP): The exact date the offline LLM scraped and verified this price.
- `source_supersession_id` (STRING): The ID of the document that validates this price over older versions.
"""

patch_intent = """
---
## SYSTEMIC PATCH: Standardized Double JSON Wrapper
*(Added via Unified Context Analysis)*

### 1. Parallel Payload Structure
When the Intent Classifier detects a "Mixed Intent" (both Symptom and Cost), the pipelines run in parallel. The API Gateway MUST wrap both results in a standardized double JSON payload to prevent frontend parsing crashes:

```json
{
  "intent": "mixed",
  "data": {
    "triage_data": { /* clinical response */ },
    "financial_data": { /* cost response */ }
  }
}
```
"""

def append_to_file(filename, content):
    filepath = os.path.join(docs_dir, filename)
    if os.path.exists(filepath):
        with open(filepath, 'a', encoding='utf-8') as f:
            f.write(content)
            print(f"Patched {filename}")
    else:
        print(f"File {filename} not found.")

append_to_file("05_FRONTEND_SPEC.md", patch_frontend)
append_to_file("03_SYSTEM_ARCHITECTURE.md", patch_arch)
append_to_file("07_DATA_CATALOG.md", patch_data)
append_to_file("16_INTENT_ROUTING_AND_GOVT_FINANCIAL_PIPELINE.md", patch_intent)
