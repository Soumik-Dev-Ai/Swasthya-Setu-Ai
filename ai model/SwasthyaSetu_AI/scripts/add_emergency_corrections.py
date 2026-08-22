import json

DATA_PATH = "data/track_a_v2.json"

new_examples = [
    {
        "id": "safe001",
        "text": "bache ko bahut tez bukhar hai aur woh properly respond nahi kar raha",
        "language": "hinglish",
        "symptom_category": "pediatric",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Explicit pediatric emergency with severe fever and reduced responsiveness"
    },
    {
        "id": "safe002",
        "text": "mera baby fever mein behosh jaisa ho raha hai aur response bahut kam hai",
        "language": "hinglish",
        "symptom_category": "pediatric",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Explicit pediatric emergency with fever and markedly reduced responsiveness"
    },
    {
        "id": "safe003",
        "text": "bache ko bukhar ke saath jhatke aa rahe hain aur woh normal response nahi de raha",
        "language": "hinglish",
        "symptom_category": "pediatric",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Explicit pediatric emergency with fever, seizure-like activity and reduced responsiveness"
    },
    {
        "id": "safe004",
        "text": "mera bacha fever mein hai aur baar baar behosh ho raha hai",
        "language": "hinglish",
        "symptom_category": "pediatric",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Explicit pediatric emergency with fever and recurrent loss of consciousness"
    },
    {
        "id": "safe005",
        "text": "high fever ke saath bacha bahut sleepy hai aur bulane par response nahi karta",
        "language": "hinglish",
        "symptom_category": "pediatric",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Explicit pediatric emergency with high fever and impaired responsiveness"
    },
    {
        "id": "safe006",
        "text": "bacha kaanp raha hai, fever bahut high hai aur woh normally baat nahi kar pa raha",
        "language": "hinglish",
        "symptom_category": "pediatric",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Explicit pediatric emergency with high fever, shaking and altered responsiveness"
    },
]

with open(DATA_PATH, "r", encoding="utf-8") as file:
    data = json.load(file)

existing = data["examples"]

existing_ids = {x["id"] for x in existing}
existing_texts = {
    x["text"].strip().lower()
    for x in existing
}

added = 0

for example in new_examples:
    if example["id"] in existing_ids:
        continue

    if example["text"].strip().lower() in existing_texts:
        continue

    existing.append(example)
    existing_ids.add(example["id"])
    existing_texts.add(example["text"].strip().lower())
    added += 1

data["examples"] = existing

with open(DATA_PATH, "w", encoding="utf-8") as file:
    json.dump(data, file, ensure_ascii=False, indent=2)

print("Added:", added)
print("Total examples:", len(existing))
print("Saved:", DATA_PATH)