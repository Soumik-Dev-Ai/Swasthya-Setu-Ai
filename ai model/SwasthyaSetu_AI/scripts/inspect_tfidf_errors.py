import json

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split


DATA_PATH = "data/track_a_v2.json"


# -----------------------------
# Load data
# -----------------------------

with open(DATA_PATH, "r", encoding="utf-8") as file:
    data = json.load(file)

examples = data["examples"]

texts = [x["text"] for x in examples]
urgency = [x["urgency_tier"] for x in examples]
categories = [x["symptom_category"] for x in examples]


# -----------------------------
# Same split as training
# -----------------------------

(
    X_train,
    X_test,
    y_urgency_train,
    y_urgency_test,
    y_category_train,
    y_category_test,
) = train_test_split(
    texts,
    urgency,
    categories,
    test_size=0.2,
    random_state=42,
    stratify=urgency,
)


# -----------------------------
# TF-IDF
# -----------------------------

vectorizer = TfidfVectorizer(
    lowercase=True,
    ngram_range=(1, 2),
    min_df=1,
)

X_train_vectors = vectorizer.fit_transform(X_train)
X_test_vectors = vectorizer.transform(X_test)


# -----------------------------
# Category classifier
# -----------------------------

category_clf = LogisticRegression(
    max_iter=2000,
    class_weight="balanced",
    random_state=42,
)

category_clf.fit(
    X_train_vectors,
    y_category_train,
)

predictions = category_clf.predict(X_test_vectors)


# -----------------------------
# Print all test examples
# -----------------------------

print("\n===================================")
print("CATEGORY ERROR ANALYSIS")
print("===================================")

for i, (text, actual, predicted) in enumerate(
    zip(X_test, y_category_test, predictions),
    start=1,
):

    status = "CORRECT" if actual == predicted else "WRONG"

    print(f"\n[{i}] {status}")
    print("Text:", text)
    print("Actual:   ", actual)
    print("Predicted:", predicted)


# -----------------------------
# Wrong predictions only
# -----------------------------

print("\n===================================")
print("WRONG CATEGORY PREDICTIONS")
print("===================================")

wrong_count = 0

for text, actual, predicted in zip(
    X_test,
    y_category_test,
    predictions,
):

    if actual != predicted:

        wrong_count += 1

        print(f"\nWrong #{wrong_count}")
        print("Text:", text)
        print("Actual:", actual)
        print("Predicted:", predicted)


print("\nTotal wrong:", wrong_count)