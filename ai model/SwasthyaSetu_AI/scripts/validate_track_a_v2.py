import json

DATA_PATH = "data/track_a_v2.json"

REQUIRED_FIELDS = {
    "id",
    "text",
    "language",
    "symptom_category",
    "urgency_tier",
    "source",
    "label_basis",
}

ALLOWED_CATEGORIES = {
    "respiratory",
    "gastrointestinal",
    "cardiovascular",
    "maternal_health",
    "pediatric",
    "injury_trauma",
    "fever_infectious",
    "musculoskeletal",
    "mental_health",
    "chronic_ncd",
    "dermatological",
    "ophthalmic",
    "other",
}

ALLOWED_URGENCY = {
    "EMERGENCY",
    "CONSULT_SOON",
    "SELF_CARE_ADVISORY",
}


with open(DATA_PATH, "r", encoding="utf-8") as file:
    data = json.load(file)

examples = data["examples"]

errors = []

ids = []
texts = []

for example in examples:

    missing = REQUIRED_FIELDS - set(example.keys())

    if missing:
        errors.append(
            f"{example.get('id', 'UNKNOWN')}: missing {missing}"
        )

    if example.get("symptom_category") not in ALLOWED_CATEGORIES:
        errors.append(
            f"{example.get('id', 'UNKNOWN')}: invalid category"
        )

    if example.get("urgency_tier") not in ALLOWED_URGENCY:
        errors.append(
            f"{example.get('id', 'UNKNOWN')}: invalid urgency"
        )

    ids.append(example.get("id"))
    texts.append(example.get("text", "").strip().lower())


# Duplicate IDs
duplicate_ids = {
    x for x in ids if ids.count(x) > 1
}

if duplicate_ids:
    errors.append(
        f"Duplicate IDs: {duplicate_ids}"
    )


# Duplicate text
duplicate_texts = {
    x for x in texts if texts.count(x) > 1
}

if duplicate_texts:
    errors.append(
        f"Duplicate texts: {duplicate_texts}"
    )


print("===================================")
print("TRACK A V2 VALIDATION")
print("===================================")

print("Total examples:", len(examples))

if errors:
    print("\nVALIDATION FAILED")
    for error in errors:
        print("-", error)
else:
    print("Validation: PASSED")

    print("\nCategory distribution:")

    category_counts = {}

    for example in examples:
        category = example["symptom_category"]
        category_counts[category] = category_counts.get(category, 0) + 1

    for category, count in sorted(category_counts.items()):
        print(f"  {category}: {count}")

    print("\nUrgency distribution:")

    urgency_counts = {}

    for example in examples:
        urgency = example["urgency_tier"]
        urgency_counts[urgency] = urgency_counts.get(urgency, 0) + 1

    for urgency, count in urgency_counts.items():
        print(f"  {urgency}: {count}")