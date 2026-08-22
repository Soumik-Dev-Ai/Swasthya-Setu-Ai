import json

with open(
    "data/track_a_combined.json",
    "r",
    encoding="utf-8"
) as file:
    data = json.load(file)

examples = data["examples"]

required_fields = [
    "id",
    "text",
    "language",
    "symptom_category",
    "urgency_tier",
    "source",
    "label_basis"
]

errors = []

# Check required fields
for example in examples:
    for field in required_fields:
        if field not in example or not example[field]:
            errors.append(
                f"{example.get('id', 'UNKNOWN')}: missing {field}"
            )

# Check duplicate IDs
ids = [example["id"] for example in examples]

if len(ids) != len(set(ids)):
    errors.append("Duplicate IDs found")

# Check allowed urgency labels
allowed_urgency = {
    "EMERGENCY",
    "CONSULT_SOON",
    "SELF_CARE_ADVISORY"
}

for example in examples:
    if example["urgency_tier"] not in allowed_urgency:
        errors.append(
            f"{example['id']}: invalid urgency tier"
        )

print("Total examples:", len(examples))

if errors:
    print("\nERRORS FOUND:")
    for error in errors:
        print("-", error)
else:
    print("Dataset validation: PASSED")