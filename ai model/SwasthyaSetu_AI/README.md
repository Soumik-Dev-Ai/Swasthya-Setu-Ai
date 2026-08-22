# SwasthyaSetu AI

SwasthyaSetu AI is a health triage and healthcare-scheme matching prototype.

The system has two main components:

## Track A: Health Triage

Track A classifies a user's health query into:

- Urgency tier
  - EMERGENCY
  - CONSULT_SOON
  - SELF_CARE_ADVISORY

- Symptom category
  - cardiovascular
  - chronic_ncd
  - dermatological
  - fever_infectious
  - gastrointestinal
  - injury_trauma
  - maternal_health
  - mental_health
  - musculoskeletal
  - ophthalmic
  - other
  - pediatric
  - respiratory

### Model

Track A uses:

- TF-IDF text features
- Logistic Regression classifiers
- One classifier for urgency
- One classifier for symptom category

### Evaluation

Dataset:

- Total examples: 121
- Training examples: 96
- Test examples: 25

Results:

- Urgency accuracy: 76%
- EMERGENCY recall: 100%
- Symptom-category accuracy: 88%

## Track B: Scheme Matching

Track B matches a user's query with relevant healthcare schemes.

The retrieval system uses:

- TF-IDF similarity
- Scheme metadata
- Keyword and eligibility signals

The provided starter evaluation contains 6 test queries.

Result:

- Correct: 6/6
- Recall@1: 100%

## API

The project uses FastAPI to expose the trained models through an API.

### Start the API

Activate the project environment and run:

```bash
uvicorn api_service.app:app --reload