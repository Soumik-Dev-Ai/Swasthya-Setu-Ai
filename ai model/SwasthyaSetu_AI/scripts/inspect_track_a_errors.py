import json

from sentence_transformers import SentenceTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split


DATA_PATH = "data/track_a_v2.json"

with open(DATA_PATH, "r", encoding="utf-8") as file:
    data = json.load(file)

examples = data["examples"]

texts = [x["text"] for x in examples]
urgency = [x["urgency_tier"] for x in examples]

# Use the SAME split as training
X_train, X_test, y_train, y_test = train_test_split(
    texts,
    urgency,
    test_size=0.2,
    random_state=42,
    stratify=urgency
)

print("Test examples:", len(X_test))

# Load embeddings
embedder = SentenceTransformer(
    "paraphrase-multilingual-MiniLM-L12-v2"
)

X_train_embeddings = embedder.encode(
    X_train,
    normalize_embeddings=True
)

X_test_embeddings = embedder.encode(
    X_test,
    normalize_embeddings=True
)

# Train the same classifier
classifier = LogisticRegression(
    max_iter=1000,
    class_weight="balanced",
    random_state=42
)

classifier.fit(
    X_train_embeddings,
    y_train
)

predictions = classifier.predict(X_test_embeddings)

print("\n===================================")
print("TRACK A ERROR ANALYSIS")
print("===================================")

for i, (text, actual, predicted) in enumerate(
    zip(X_test, y_test, predictions),
    start=1
):

    status = "CORRECT" if actual == predicted else "WRONG"

    print(f"\n[{i}] {status}")
    print("Text:", text)
    print("Actual:  ", actual)
    print("Predicted:", predicted)

print("\n===================================")
print("WRONG PREDICTIONS ONLY")
print("===================================")

wrong_count = 0

for text, actual, predicted in zip(
    X_test,
    y_test,
    predictions
):

    if actual != predicted:

        wrong_count += 1

        print(f"\nWrong #{wrong_count}")
        print("Text:", text)
        print("Actual:", actual)
        print("Predicted:", predicted)

print("\nTotal wrong:", wrong_count)