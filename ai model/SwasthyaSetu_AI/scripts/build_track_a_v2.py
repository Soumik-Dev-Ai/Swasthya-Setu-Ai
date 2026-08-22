import json


STARTER_PATH = "data/09_STARTER_track_a_symptom_seed_data.json"
EXPANDED_PATH = "data/track_a_expanded.json"
OUTPUT_PATH = "data/track_a_v2.json"


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


def load_examples(path):
    with open(path, "r", encoding="utf-8") as file:
        data = json.load(file)

    return data["examples"]


def validate_example(example):
    missing = REQUIRED_FIELDS - set(example.keys())

    if missing:
        raise ValueError(
            f"{example.get('id', 'UNKNOWN')} missing fields: {missing}"
        )

    if example["symptom_category"] not in ALLOWED_CATEGORIES:
        raise ValueError(
            f"{example['id']} has invalid category: "
            f"{example['symptom_category']}"
        )

    if example["urgency_tier"] not in ALLOWED_URGENCY:
        raise ValueError(
            f"{example['id']} has invalid urgency: "
            f"{example['urgency_tier']}"
        )


starter_examples = load_examples(STARTER_PATH)
expanded_examples = load_examples(EXPANDED_PATH)

all_examples = starter_examples + expanded_examples

# Remove duplicate examples by text.
# We keep the first occurrence so the starter dataset remains authoritative.
unique_examples = []
seen_text = set()
seen_ids = set()

for example in all_examples:
    validate_example(example)

    text_key = example["text"].strip().lower()

    if example["id"] in seen_ids:
        print(f"Skipping duplicate ID: {example['id']}")
        continue

    if text_key in seen_text:
        print(f"Skipping duplicate text: {example['text']}")
        continue

    unique_examples.append(example)
    seen_ids.add(example["id"])
    seen_text.add(text_key)


# Count categories
category_counts = {}

for example in unique_examples:
    category = example["symptom_category"]
    category_counts[category] = category_counts.get(category, 0) + 1


# Count urgency
urgency_counts = {}

for example in unique_examples:
    urgency = example["urgency_tier"]
    urgency_counts[urgency] = urgency_counts.get(urgency, 0) + 1


# Count languages
language_counts = {}

for example in unique_examples:
    language = example["language"]
    language_counts[language] = language_counts.get(language, 0) + 1


output = {
    "dataset_name": "SwasthyaSetu AI Track A v2",
    "description": (
        "Combined Track A bootstrap dataset using the supplied starter "
        "dataset and team-authored variations."
    ),
    "taxonomy": {
        "symptom_categories": sorted(ALLOWED_CATEGORIES),
        "urgency_tiers": sorted(ALLOWED_URGENCY),
    },
    "examples": unique_examples,
    "statistics": {
        "total_examples": len(unique_examples),
        "category_counts": category_counts,
        "urgency_counts": urgency_counts,
        "language_counts": language_counts,
    },
}


with open(OUTPUT_PATH, "w", encoding="utf-8") as file:
    json.dump(output, file, ensure_ascii=False, indent=2)


print("\n===================================")
print("TRACK A V2 DATASET CREATED")
print("===================================")

print("Starter examples:", len(starter_examples))
print("Expanded examples:", len(expanded_examples))
print("Unique examples:", len(unique_examples))

print("\nUrgency distribution:")
for key, value in urgency_counts.items():
    print(f"  {key}: {value}")

print("\nLanguage distribution:")
for key, value in language_counts.items():
    print(f"  {key}: {value}")

print("\nCategory distribution:")
for key, value in sorted(category_counts.items()):
    print(f"  {key}: {value}")

print("\nSaved to:", OUTPUT_PATH)