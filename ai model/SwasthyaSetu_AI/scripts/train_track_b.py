import json

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


DATA_PATH = "data/10_STARTER_track_b_scheme_dataset.json"


# ---------------------------------
# Load dataset
# ---------------------------------

with open(DATA_PATH, "r", encoding="utf-8") as file:
    data = json.load(file)

schemes = data["schemes"]
query_pairs = data["query_to_scheme_pairs"]

print("Schemes:", len(schemes))
print("Test queries:", len(query_pairs))


# ---------------------------------
# Build searchable scheme text
# ---------------------------------

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


vectorizer = TfidfVectorizer(
    lowercase=True,
    ngram_range=(1, 2),
)

scheme_vectors = vectorizer.fit_transform(scheme_texts)


# ---------------------------------
# Intent / eligibility signals
# ---------------------------------

def keyword_boost(query, scheme_id):

    q = query.lower()
    boost = 0.0

    # PMBJP: generic / cheap medicines
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

    # AMRIT: branded medicines / implants
    elif scheme_id == "amrit_pharmacy":

        keywords = [
            "branded",
            "market price",
            "implant",
        ]

        if any(word in q for word in keywords):
            boost += 0.30

    # Ayushman Arogya Mandir: primary care / doctor / OPD
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

    # Cataract package
    elif scheme_id == "pmjay_cataract_pkg":

        if "cataract" in q:
            boost += 0.50

    # PM-JAY Vay Vandana
    elif scheme_id == "pmjay_vay_vandana":

        if any(word in q for word in [
            "elderly",
            "elder",
            "father",
            "mother",
            "senior",
            "72",
            "70",
        ]):
            boost += 0.35

    # General PM-JAY
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


# ---------------------------------
# Evaluate queries
# ---------------------------------

correct = 0

print("\n===================================")
print("TRACK B IMPROVED RETRIEVAL")
print("===================================")

for i, pair in enumerate(query_pairs, start=1):

    query = pair["query_text"]
    expected = pair["correct_scheme_id"]

    query_vector = vectorizer.transform([query])

    tfidf_scores = cosine_similarity(
        query_vector,
        scheme_vectors,
    )[0]

    final_scores = []

    for index, scheme in enumerate(schemes):

        boost = keyword_boost(
            query,
            scheme["scheme_id"],
        )

        final_score = float(tfidf_scores[index]) + boost

        final_scores.append(final_score)

    ranked_indices = sorted(
        range(len(schemes)),
        key=lambda x: final_scores[x],
        reverse=True,
    )

    top_index = ranked_indices[0]

    predicted = schemes[top_index]["scheme_id"]

    is_correct = predicted == expected

    if is_correct:
        correct += 1

    print(f"\nQuery {i}")
    print("Query:", query)
    print("Expected:", expected)
    print("Predicted:", predicted)
    print("Result:", "CORRECT" if is_correct else "WRONG")

    print("\nTop 3:")

    for rank, index in enumerate(
        ranked_indices[:3],
        start=1,
    ):

        print(
            f"  {rank}. "
            f"{schemes[index]['scheme_name']} "
            f"({schemes[index]['scheme_id']}) "
            f"score={final_scores[index]:.3f}"
        )


# ---------------------------------
# Final results
# ---------------------------------

accuracy = correct / len(query_pairs)

print("\n===================================")
print("TRACK B RESULTS")
print("===================================")

print("Correct:", correct)
print("Total:", len(query_pairs))
print("Recall@1 / Accuracy:", round(accuracy, 3))
print("Percentage:", round(accuracy * 100, 1), "%")