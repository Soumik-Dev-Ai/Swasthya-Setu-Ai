import json

# Load original starter dataset
with open(
    "data/09_STARTER_track_a_symptom_seed_data.json",
    "r",
    encoding="utf-8"
) as file:
    starter_data = json.load(file)

# Load our expanded examples
with open(
    "data/track_a_expanded.json",
    "r",
    encoding="utf-8"
) as file:
    expanded_data = json.load(file)

# Combine both lists
all_examples = starter_data["examples"] + expanded_data["examples"]

# Save combined dataset
output = {
    "_readme": "Combined Track A prototype dataset. Contains the original starter examples plus team-authored variations.",
    "examples": all_examples
}

with open(
    "data/track_a_combined.json",
    "w",
    encoding="utf-8"
) as file:
    json.dump(output, file, ensure_ascii=False, indent=2)

print("Original examples:", len(starter_data["examples"]))
print("New examples:", len(expanded_data["examples"]))
print("Total examples:", len(all_examples))