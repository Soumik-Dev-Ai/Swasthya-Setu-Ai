import json
import os

import joblib
from fastapi import FastAPI
from pydantic import BaseModel
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer


# ==========================================
# PATHS
# ==========================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MODEL_DIR = os.path.join(
    BASE_DIR,
    "models",
    "triage-tfidf-v0.1.0"
)

TRACK_B_PATH = os.path.join(
    BASE_DIR,
    "data",
    "10_STARTER_track_b_scheme_dataset.json"
)


# ==========================================
# LOAD TRACK A MODELS
# ==========================================

urgency_clf = joblib.load(
    os.path.join(MODEL_DIR, "urgency_clf.joblib")
)

category_clf = joblib.load(
    os.path.join(MODEL_DIR, "category_clf.joblib")
)
track_a_vectorizer = joblib.load(
    os.path.join(MODEL_DIR, "tfidf_vectorizer.joblib")
)


# ==========================================
# LOAD TRACK B DATA
# ==========================================

with open(TRACK_B_PATH, "r", encoding="utf-8") as file:
    track_b_data = json.load(file)

schemes = track_b_data["schemes"]


# ==========================================
# BUILD TRACK B VECTORS
# ==========================================

scheme_texts = []

for scheme in schemes:

    text = " ".join([
        scheme["scheme_name"],
        scheme["eligibility_criteria"],
        scheme["coverage_amount"],
        scheme["coverage_scope"],
        " ".join(scheme["applicable_symptom_categories"]),
        scheme["region"],
    ])

    scheme_texts.append(text)


track_b_vectorizer = TfidfVectorizer(
    lowercase=True,
    ngram_range=(1, 2),
)

scheme_vectors = track_b_vectorizer.fit_transform(scheme_texts)


# ==========================================
# TRACK B KEYWORD BOOST
# ==========================================

def keyword_boost(query, scheme_id):

    q = query.lower()
    boost = 0.0

    if scheme_id == "pmbjp_generic_medicines":

        keywords = [
            "cheapest",
            "cheap",
            "generic",
            "low cost",
            "medicine",
            "medicines",
        ]

        if any(word in q for word in keywords):
            boost += 0.25

    elif scheme_id == "amrit_pharmacy":

        keywords = [
            "branded",
            "market price",
            "implant",
        ]

        if any(word in q for word in keywords):
            boost += 0.30

    elif scheme_id == "ayushman_arogya_mandir_opd":

        keywords = [
            "doctor",
            "check",
            "basic",
            "clinic",
            "consultation",
            "fever",
            "cough",
            "opd",
            "private clinic",
        ]

        matches = sum(word in q for word in keywords)

        boost += 0.10 * matches

    elif scheme_id == "pmjay_cataract_pkg":

        if "cataract" in q:
            boost += 0.50

    elif scheme_id == "pmjay_vay_vandana":

        keywords = [
            "elderly",
            "elder",
            "father",
            "mother",
            "senior",
            "72",
            "70",
        ]

        if any(word in q for word in keywords):
            boost += 0.35

    elif scheme_id == "pmjay_general":

        keywords = [
            "family",
            "below poverty",
            "poor",
            "low income",
            "hospital admission",
            "hospital",
            "surgery",
            "insurance",
        ]

        matches = sum(word in q for word in keywords)

        boost += 0.08 * matches

    return boost


# ==========================================
# TRACK B RETRIEVAL
# ==========================================

def find_scheme(query):

    query_vector = track_b_vectorizer.transform([query])

    tfidf_scores = cosine_similarity(
        query_vector,
        scheme_vectors
    )[0]

    final_scores = []

    for index, scheme in enumerate(schemes):

        boost = keyword_boost(
            query,
            scheme["scheme_id"]
        )

        score = float(tfidf_scores[index]) + boost

        final_scores.append(score)

    best_index = max(
        range(len(schemes)),
        key=lambda index: final_scores[index]
    )

    return schemes[best_index], final_scores[best_index]


# ==========================================
# FASTAPI
# ==========================================

app = FastAPI(
    title="SwasthyaSetu AI",
    description="Health triage and scheme matching API",
    version="0.1.0"
)


# ==========================================
# REQUEST FORMAT
# ==========================================

class HealthQuery(BaseModel):
    text: str


# ==========================================
# HEALTH CHECK
# ==========================================

@app.get("/")
def root():

    return {
        "message": "SwasthyaSetu AI API is running",
        "status": "ok"
    }


# ==========================================
# TRIAGE ENDPOINT
# ==========================================

@app.post("/triage")
def triage(request: HealthQuery):

    text = request.text.strip()

    if not text:
        return {
            "error": "Query cannot be empty"
        }

    # ------------------------------
    # Track A
    # ------------------------------

    text_vector = track_a_vectorizer.transform([text])

    urgency = urgency_clf.predict(
        text_vector
    )[0]

    category = category_clf.predict(
        text_vector
    )[0]


    # ------------------------------
    # Track B
    # ------------------------------

    scheme, scheme_score = find_scheme(text)


    # ------------------------------
    # Response
    # ------------------------------

        # ------------------------------
    # Safety / response priority
    # ------------------------------

    if urgency == "EMERGENCY":

        safety_message = (
            "This query was classified as an emergency. "
            "Please seek urgent medical care or contact local emergency services. "
            "Do not delay emergency care while checking scheme eligibility."
        )

        response_priority = "URGENT_MEDICAL_CARE"

    elif urgency == "CONSULT_SOON":

        safety_message = (
            "This query was classified as requiring consultation soon. "
            "Consider consulting a qualified healthcare professional."
        )

        response_priority = "MEDICAL_CONSULTATION"

    else:

        safety_message = (
            "This query was classified as suitable for self-care guidance. "
            "If symptoms worsen or new serious symptoms appear, seek medical care."
        )

        response_priority = "SELF_CARE"

    # ------------------------------
    # Final response
    # ------------------------------

    return {
        "query": text,

        "triage": {
            "urgency": urgency,
            "symptom_category": category
        },

        "response_priority": response_priority,

        "safety_message": safety_message,

        "scheme_match": {
            "scheme_id": scheme["scheme_id"],
            "scheme_name": scheme["scheme_name"],
            "eligibility": scheme["eligibility_criteria"],
            "coverage": scheme["coverage_amount"],
            "scope": scheme["coverage_scope"],
            "region": scheme["region"],
            "matching_score": round(
                scheme_score,
                3
            ),
            "note": (
                "Scheme matching is informational only. "
                "Actual eligibility and coverage must be verified "
                "with the official scheme or empaneled provider."
            )
        }
    }