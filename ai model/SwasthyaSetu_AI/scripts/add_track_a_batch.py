import json

DATA_PATH = "data/track_a_v2.json"

new_examples = [
    {
        "id": "v001",
        "text": "pregnant hoon aur pet mein bahut tez dard ke saath bleeding ho rahi hai",
        "language": "hinglish",
        "symptom_category": "maternal_health",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Team heuristic based on starter pattern: severe abdominal pain with bleeding during pregnancy"
    },
    {
        "id": "v002",
        "text": "pregnancy mein achanak bahut zyada khoon aa raha hai",
        "language": "hinglish",
        "symptom_category": "maternal_health",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Team heuristic based on starter pattern: heavy bleeding during pregnancy"
    },
    {
        "id": "v003",
        "text": "delivery ke baad bleeding bahut zyada ho rahi hai",
        "language": "hinglish",
        "symptom_category": "maternal_health",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Team heuristic based on starter postpartum heavy-bleeding pattern"
    },
    {
        "id": "v004",
        "text": "pregnant hoon, pet mein halka discomfort hai lekin bleeding nahi hai",
        "language": "hinglish",
        "symptom_category": "maternal_health",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Team-authored conservative maternal-health example; insufficient information for self-care classification"
    },
    {
        "id": "v005",
        "text": "pregnancy mein kuch dino se unusual pain ho raha hai",
        "language": "hinglish",
        "symptom_category": "maternal_health",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Team-authored conservative maternal-health example for persistent pain"
    },

    {
        "id": "v006",
        "text": "mere bache ko bahut tez bukhar hai aur jhatke aa rahe hain",
        "language": "hinglish",
        "symptom_category": "pediatric",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Variation of starter pediatric high-fever with convulsions pattern"
    },
    {
        "id": "v007",
        "text": "bacha bukhar mein kaanp raha hai aur response kam de raha hai",
        "language": "hinglish",
        "symptom_category": "pediatric",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Team-authored pediatric emergency variation based on severe fever/red-flag presentation"
    },
    {
        "id": "v008",
        "text": "mera bacha teen din se fever mein hai aur khana bhi nahi kha raha",
        "language": "hinglish",
        "symptom_category": "pediatric",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Variation of starter persistent pediatric fever and reduced intake pattern"
    },
    {
        "id": "v009",
        "text": "bache ko do din se bukhar hai lekin koi aur serious symptom nahi hai",
        "language": "hinglish",
        "symptom_category": "pediatric",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Team-authored conservative pediatric fever example"
    },
    {
        "id": "v010",
        "text": "bache ko halka cold hai aur thodi chheenk aa rahi hai",
        "language": "hinglish",
        "symptom_category": "pediatric",
        "urgency_tier": "SELF_CARE_ADVISORY",
        "source": "team_authored_variation",
        "label_basis": "Team-authored mild pediatric cold variation"
    },

    {
        "id": "v011",
        "text": "achanak seene mein pressure hai aur paseena aa raha hai",
        "language": "hinglish",
        "symptom_category": "cardiovascular",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Variation of starter chest-tightness with sweating emergency pattern"
    },
    {
        "id": "v012",
        "text": "chest mein tightness ke saath saans lene mein problem ho rahi hai",
        "language": "hinglish",
        "symptom_category": "cardiovascular",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Team heuristic based on starter chest pain/breathlessness red-flag pattern"
    },
    {
        "id": "v013",
        "text": "seene mein dard ho raha hai aur saath mein saans phool rahi hai",
        "language": "hinglish",
        "symptom_category": "cardiovascular",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Variation of starter chest pain plus breathlessness emergency pattern"
    },
    {
        "id": "v014",
        "text": "BP high rehta hai aur follow-up ke liye doctor se milna hai",
        "language": "hinglish",
        "symptom_category": "chronic_ncd",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Variation of chronic hypertension follow-up pattern"
    },
    {
        "id": "v015",
        "text": "sugar ki medicine khatam ho gayi hai aur follow-up chahiye",
        "language": "hinglish",
        "symptom_category": "chronic_ncd",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Variation of starter chronic-medication-lapse pattern"
    },
    {
        "id": "v016",
        "text": "diabetes hai aur routine checkup ke liye jaana hai",
        "language": "hinglish",
        "symptom_category": "chronic_ncd",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Team-authored chronic NCD follow-up example"
    },
    {
        "id": "v017",
        "text": "BP high hai lekin medicine regularly le raha hoon aur abhi koi aur symptom nahi hai",
        "language": "hinglish",
        "symptom_category": "chronic_ncd",
        "urgency_tier": "SELF_CARE_ADVISORY",
        "source": "Variation of starter stable high-BP follow-up pattern"
    },

    {
        "id": "v018",
        "text": "bahut ghabrahat ho rahi hai aur kai din se neend nahi aa rahi",
        "language": "hinglish",
        "symptom_category": "mental_health",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Variation of starter anxiety/restlessness with sleep disturbance pattern"
    },
    {
        "id": "v019",
        "text": "mann bahut restless rehta hai aur sleep disturb hai",
        "language": "hinglish",
        "symptom_category": "mental_health",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Variation of starter ongoing anxiety and sleep disturbance pattern"
    },
    {
        "id": "v020",
        "text": "kuch dino se bahut anxiety feel ho rahi hai",
        "language": "hinglish",
        "symptom_category": "mental_health",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Team-authored persistent mental-health symptom example"
    },

    {
        "id": "v021",
        "text": "aankh se achanak dikhna band ho gaya",
        "language": "hinglish",
        "symptom_category": "ophthalmic",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Variation of starter sudden vision-loss emergency pattern"
    },
    {
        "id": "v022",
        "text": "ek aankh se suddenly vision kam ho gaya",
        "language": "hinglish",
        "symptom_category": "ophthalmic",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Variation of starter sudden vision-loss emergency pattern"
    },

    {
        "id": "v023",
        "text": "peeth mein dard hai bhaari cheez uthane ke baad",
        "language": "hinglish",
        "symptom_category": "musculoskeletal",
        "urgency_tier": "SELF_CARE_ADVISORY",
        "source": "team_authored_variation",
        "label_basis": "Variation of starter mild back-pain after lifting pattern"
    },
    {
        "id": "v024",
        "text": "ghutne ka dard roz seedhi chadhne par badh jata hai",
        "language": "hinglish",
        "symptom_category": "musculoskeletal",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Variation of starter ongoing knee-pain pattern"
    },

    {
        "id": "v025",
        "text": "girne ke baad sar se khoon bahut nikal raha hai",
        "language": "hinglish",
        "symptom_category": "injury_trauma",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Variation of starter head injury with bleeding pattern"
    },
    {
        "id": "v026",
        "text": "ungli par chhota cut hai aur bleeding ruk gayi hai",
        "language": "hinglish",
        "symptom_category": "injury_trauma",
        "urgency_tier": "SELF_CARE_ADVISORY",
        "source": "team_authored_variation",
        "label_basis": "Variation of starter minor controlled cut pattern"
    },

    {
        "id": "v027",
        "text": "bukhar paanch din se hai aur abhi tak theek nahi hua",
        "language": "hinglish",
        "symptom_category": "fever_infectious",
        "urgency_tier": "CONSULT_SOON",
        "source": "team_authored_variation",
        "label_basis": "Variation of starter prolonged-fever pattern"
    },
    {
        "id": "v028",
        "text": "halka fever hai aur thodi weakness bhi hai",
        "language": "hinglish",
        "symptom_category": "fever_infectious",
        "urgency_tier": "SELF_CARE_ADVISORY",
        "source": "team_authored_variation",
        "label_basis": "Variation of starter mild fever with fatigue pattern"
    },

    {
        "id": "v029",
        "text": "pet mein halka dard hai khana khane ke baad theek ho jata hai",
        "language": "hinglish",
        "symptom_category": "gastrointestinal",
        "urgency_tier": "SELF_CARE_ADVISORY",
        "source": "team_authored_variation",
        "label_basis": "Variation of starter mild post-meal abdominal discomfort pattern"
    },
    {
        "id": "v030",
        "text": "bahut tez vomiting ke saath pet mein unbearable pain hai",
        "language": "hinglish",
        "symptom_category": "gastrointestinal",
        "urgency_tier": "EMERGENCY",
        "source": "team_authored_variation",
        "label_basis": "Variation of starter severe vomiting plus severe abdominal pain pattern"
    }
]


with open(DATA_PATH, "r", encoding="utf-8") as file:
    data = json.load(file)

existing = data["examples"]
existing_ids = {x["id"] for x in existing}
existing_texts = {x["text"].strip().lower() for x in existing}

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

print("Added examples:", added)
print("Total examples:", len(existing))
print("Saved:", DATA_PATH)