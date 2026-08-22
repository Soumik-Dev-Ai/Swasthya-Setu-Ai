import json
import os
import joblib

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    recall_score,
)


DATA_PATH = "data/track_a_v2.json"
MODEL_DIR = "models/triage-tfidf-v0.1.0"


# -----------------------------
# 1. Load dataset
# -----------------------------

with open(DATA_PATH, "r", encoding="utf-8") as file:
    data = json.load(file)

examples = data["examples"]

texts = [x["text"] for x in examples]
urgency_labels = [x["urgency_tier"] for x in examples]
category_labels = [x["symptom_category"] for x in examples]

print("Total examples:", len(examples))


# -----------------------------
# 2. Split dataset
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
    urgency_labels,
    category_labels,
    test_size=0.2,
    random_state=42,
    stratify=urgency_labels,
)

print("Training examples:", len(X_train))
print("Test examples:", len(X_test))


# -----------------------------
# 3. TF-IDF
# -----------------------------

print("\nCreating TF-IDF features...")

vectorizer = TfidfVectorizer(
    lowercase=True,
    ngram_range=(1, 2),
    min_df=1,
)

X_train_vectors = vectorizer.fit_transform(X_train)
X_test_vectors = vectorizer.transform(X_test)


# -----------------------------
# 4. Train urgency classifier
# -----------------------------

print("Training urgency classifier...")

urgency_clf = LogisticRegression(
    max_iter=2000,
    class_weight="balanced",
    random_state=42,
)

urgency_clf.fit(
    X_train_vectors,
    y_urgency_train,
)


# -----------------------------
# 5. Train category classifier
# -----------------------------

print("Training category classifier...")

category_clf = LogisticRegression(
    max_iter=2000,
    class_weight="balanced",
    random_state=42,
)

category_clf.fit(
    X_train_vectors,
    y_category_train,
)


# -----------------------------
# 6. Predictions
# -----------------------------

urgency_predictions = urgency_clf.predict(X_test_vectors)
category_predictions = category_clf.predict(X_test_vectors)


# -----------------------------
# 7. Urgency evaluation
# -----------------------------

print("\n===================================")
print("URGENCY TIER REPORT")
print("===================================")

print(
    classification_report(
        y_urgency_test,
        urgency_predictions,
        zero_division=0,
    )
)

urgency_accuracy = accuracy_score(
    y_urgency_test,
    urgency_predictions,
)

emergency_recall = recall_score(
    y_urgency_test,
    urgency_predictions,
    labels=["EMERGENCY"],
    average="micro",
    zero_division=0,
)

print("Overall urgency accuracy:", round(urgency_accuracy, 3))
print("EMERGENCY recall:", round(emergency_recall, 3))
print("Required emergency recall: >= 0.95")


# -----------------------------
# 8. Category evaluation
# -----------------------------

print("\n===================================")
print("SYMPTOM CATEGORY REPORT")
print("===================================")

print(
    classification_report(
        y_category_test,
        category_predictions,
        zero_division=0,
    )
)


# -----------------------------
# 9. Save artifacts
# -----------------------------

os.makedirs(MODEL_DIR, exist_ok=True)

joblib.dump(
    vectorizer,
    os.path.join(MODEL_DIR, "tfidf_vectorizer.joblib"),
)

joblib.dump(
    urgency_clf,
    os.path.join(MODEL_DIR, "urgency_clf.joblib"),
)

joblib.dump(
    category_clf,
    os.path.join(MODEL_DIR, "category_clf.joblib"),
)

print("\nModel artifacts saved successfully.")
print("Location:", MODEL_DIR)