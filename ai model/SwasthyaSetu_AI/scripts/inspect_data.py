import json

with open("data/09_STARTER_track_a_symptom_seed_data.json", "r", encoding="utf-8") as file:
    data = json.load(file)

examples = data["examples"]

print("Total examples:", len(examples))

print("\nFirst example:")
print(examples[0])

print("\nUrgency distribution:")
urgency_counts = {}

for example in examples:
    urgency = example["urgency_tier"]
    urgency_counts[urgency] = urgency_counts.get(urgency, 0) + 1

print(urgency_counts)

print("\nSymptom categories:")
categories = set()

for example in examples:
    categories.add(example["symptom_category"])

print(categories)