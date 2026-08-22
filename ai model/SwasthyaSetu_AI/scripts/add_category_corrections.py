import json

DATA_PATH = "data/track_a_v2.json"

new_examples = [

    # -----------------------------
    # Gastrointestinal
    # -----------------------------

    {
        "id": "cat001",
        "text": "pet mein dard ke saath baar baar vomiting ho rahi hai",
        "language": "hinglish",
        "symptom_category": "gastrointestinal",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "GI-specific abdominal pain with repeated vomiting"
    },
    {
        "id": "cat002",
        "text": "pet kharab hai aur aaj se loose motion ho rahe hain",
        "language": "hinglish",
        "symptom_category": "gastrointestinal",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "GI-specific diarrhea presentation"
    },
    {
        "id": "cat003",
        "text": "khana khane ke baad nausea aur pet mein discomfort hota hai",
        "language": "hinglish",
        "symptom_category": "gastrointestinal",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "GI-specific nausea and post-meal abdominal discomfort"
    },
    {
        "id": "cat004",
        "text": "pet mein severe pain ke saath vomiting aur loose motion dono hain",
        "language": "hinglish",
        "symptom_category": "gastrointestinal",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "GI-specific severe abdominal pain with vomiting and diarrhea"
    },

    # -----------------------------
    # Maternal health
    # -----------------------------

    {
        "id": "cat005",
        "text": "main pregnant hoon aur pregnancy ke dauran bleeding ho rahi hai",
        "language": "hinglish",
        "symptom_category": "maternal_health",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Explicit pregnancy context with bleeding"
    },
    {
        "id": "cat006",
        "text": "pregnancy mein baby movement noticeably kam ho gayi hai",
        "language": "hinglish",
        "symptom_category": "maternal_health",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Explicit pregnancy context with reduced fetal movement"
    },
    {
        "id": "cat007",
        "text": "delivery ke baad unusual bleeding ho rahi hai",
        "language": "hinglish",
        "symptom_category": "maternal_health",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Explicit postpartum context with abnormal bleeding"
    },

    # -----------------------------
    # Pediatric
    # -----------------------------

    {
        "id": "cat008",
        "text": "mera bacha bukhar mein hai aur bahut weak lag raha hai",
        "language": "hinglish",
        "symptom_category": "pediatric",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Explicit child context with fever and weakness"
    },
    {
        "id": "cat009",
        "text": "mere baby ko vomiting ho rahi hai aur woh doodh nahi pee raha",
        "language": "hinglish",
        "symptom_category": "pediatric",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Explicit infant context with vomiting and reduced feeding"
    },
    {
        "id": "cat010",
        "text": "bacha achanak behosh ho gaya aur jhatke aa rahe hain",
        "language": "hinglish",
        "symptom_category": "pediatric",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Explicit child context with loss of consciousness and seizure"
    },
    {
        "id": "cat011",
        "text": "meri beti ko do din se fever hai aur woh normally active nahi hai",
        "language": "hinglish",
        "symptom_category": "pediatric",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Explicit child context with persistent fever and reduced activity"
    },

    # -----------------------------
    # Ophthalmic
    # -----------------------------

    {
        "id": "cat012",
        "text": "aankh mein redness hai aur aankh se paani aa raha hai",
        "language": "hinglish",
        "symptom_category": "ophthalmic",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Explicit eye symptoms"
    },
    {
        "id": "cat013",
        "text": "aankh mein khujli aur jalan ho rahi hai",
        "language": "hinglish",
        "symptom_category": "ophthalmic",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Explicit eye itching and irritation"
    },
    {
        "id": "cat014",
        "text": "ek aankh se achanak clearly dikhai nahi de raha",
        "language": "hinglish",
        "symptom_category": "ophthalmic",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Explicit sudden vision disturbance"
    },

    # -----------------------------
    # Other
    # -----------------------------

    {
        "id": "cat015",
        "text": "thoda headache hai lekin koi aur symptom nahi hai",
        "language": "hinglish",
        "symptom_category": "other",
        "urgency_tier": "SELF_CARE_ADVISORY",
        "source": "team_authored_variation",
        "label_basis": "Nonspecific mild symptom without category-specific red flags"
    },
    {
        "id": "cat016",
        "text": "aaj thoda tired feel kar raha hoon",
        "language": "hinglish",
        "symptom_category": "other",
        "urgency_tier": "SELF_CARE_ADVISORY",
        "source": "team_authored_variation",
        "label_basis": "Nonspecific fatigue presentation"
    },

    # -----------------------------
    # Fever vs pediatric
    # -----------------------------

    {
        "id": "cat017",
        "text": "adult hoon aur chaar din se fever hai",
        "language": "hinglish",
        "symptom_category": "fever_infectious",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Adult persistent fever without pediatric context"
    },
    {
        "id": "cat018",
        "text": "mujhe teen din se bukhar hai aur body pain bhi hai",
        "language": "hinglish",
        "symptom_category": "fever_infectious",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "General infectious-fever presentation without child context"
    },

    # -----------------------------
    # Mental health vs other
    # -----------------------------

    {
        "id": "cat019",
        "text": "bahut anxiety ho rahi hai aur mann restless hai",
        "language": "hinglish",
        "symptom_category": "mental_health",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Explicit anxiety and restlessness"
    },
    {
        "id": "cat020",
        "text": "bas ajeeb sa feel ho raha hai lekin koi specific symptom nahi hai",
        "language": "hinglish",
        "symptom_category": "other",
        "urgency_tier": "SELF_CARE_ADVISORY",
        "source": "team_authored_variation",
        "label_basis": "Vague nonspecific complaint without explicit mental-health symptoms"
    }
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