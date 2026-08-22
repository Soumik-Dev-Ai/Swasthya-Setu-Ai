"""V2 data layer — port of frontend/src/lib/data.ts.

Static reference data (cities, hospitals, diseases, conditions, schemes,
providers) used by the v2 engine endpoints. Keeping it as plain Python
dicts/lists so the JSON returned to the frontend matches the shape of
the TypeScript objects exactly.
"""
from __future__ import annotations

import math
from typing import Callable

# ------------------------------------------------------------------ Cities

CITIES = [
    {"id": "delhi",  "nameKey": "Delhi",   "lat": 28.6139, "lon": 77.209,  "priceIndex": 1.0,  "traffic": 1.15, "state": "DL"},
    {"id": "mumbai", "nameKey": "Mumbai",  "lat": 19.076,  "lon": 72.8777, "priceIndex": 1.18, "traffic": 1.4,  "state": "MH"},
    {"id": "kolkata","nameKey": "Kolkata", "lat": 22.5726,"lon": 88.3639, "priceIndex": 0.92, "traffic": 1.1,  "state": "WB"},
    {"id": "bhopal", "nameKey": "Bhopal",  "lat": 23.2599,"lon": 77.4126, "priceIndex": 0.82, "traffic": 0.9,  "state": "MP"},
    {"id": "ranchi", "nameKey": "Ranchi",  "lat": 23.3441,"lon": 85.3096, "priceIndex": 0.8,  "traffic": 0.85, "state": "JH"},
    {"id": "patna",  "nameKey": "Patna",   "lat": 25.5941,"lon": 85.1376, "priceIndex": 0.78, "traffic": 0.9,  "state": "BR"},
    {"id": "jaipur", "nameKey": "Jaipur",  "lat": 26.9124,"lon": 75.7873, "priceIndex": 0.88, "traffic": 0.95, "state": "RJ"},
]

def city_by_id(city_id: str) -> dict:
    for c in CITIES:
        if c["id"] == city_id:
            return c
    return CITIES[0]


# ------------------------------------------------------------------ Hospitals

HOSPITALS = [
    {"id": "aiims-d", "name": "AIIMS New Delhi", "cityId": "delhi", "tier": "Govt Apex", "score": 96, "beds": 2478, "icu": True, "er24": True, "pmjay": True, "nabh": True, "bloodBank": True, "priceIndex": 0.35, "lat": 28.5672, "lon": 77.21},
    {"id": "safdarjung", "name": "Safdarjung Hospital", "cityId": "delhi", "tier": "Govt District", "score": 88, "beds": 1531, "icu": True, "er24": True, "pmjay": True, "nabh": False, "bloodBank": True, "priceIndex": 0.3, "lat": 28.5654, "lon": 77.1984},
    {"id": "apollo-d", "name": "Apollo Indraprastha", "cityId": "delhi", "tier": "Private NABH", "score": 92, "beds": 710, "icu": True, "er24": True, "pmjay": True, "nabh": True, "bloodBank": True, "priceIndex": 1.55, "lat": 28.6225, "lon": 77.2941},
    {"id": "max-saket", "name": "Max Super Speciality, Saket", "cityId": "delhi", "tier": "Private NABH", "score": 89, "beds": 530, "icu": True, "er24": True, "pmjay": False, "nabh": True, "bloodBank": True, "priceIndex": 1.7, "lat": 28.5265, "lon": 77.2056},
    {"id": "kem", "name": "KEM Hospital", "cityId": "mumbai", "tier": "Govt Apex", "score": 90, "beds": 1800, "icu": True, "er24": True, "pmjay": True, "nabh": False, "bloodBank": True, "priceIndex": 0.3, "lat": 19.0093, "lon": 72.8372},
    {"id": "kokilaben", "name": "Kokilaben Dhirubhai Ambani", "cityId": "mumbai", "tier": "Private NABH", "score": 94, "beds": 750, "icu": True, "er24": True, "pmjay": False, "nabh": True, "bloodBank": True, "priceIndex": 1.9, "lat": 19.092, "lon": 72.8364},
    {"id": "sskm", "name": "SSKM Hospital", "cityId": "kolkata", "tier": "Govt Apex", "score": 88, "beds": 1700, "icu": True, "er24": True, "pmjay": True, "nabh": False, "bloodBank": True, "priceIndex": 0.28, "lat": 22.5407, "lon": 88.3436},
    {"id": "medica-k", "name": "Medica Superspecialty", "cityId": "kolkata", "tier": "Private NABH", "score": 87, "beds": 440, "icu": True, "er24": True, "pmjay": True, "nabh": True, "bloodBank": True, "priceIndex": 1.35, "lat": 22.578, "lon": 88.4004},
    {"id": "aiims-b", "name": "AIIMS Bhopal", "cityId": "bhopal", "tier": "Govt Apex", "score": 87, "beds": 960, "icu": True, "er24": True, "pmjay": True, "nabh": False, "bloodBank": True, "priceIndex": 0.26, "lat": 23.2167, "lon": 77.4081},
    {"id": "chirayu", "name": "Chirayu Medical College", "cityId": "bhopal", "tier": "Private", "score": 84, "beds": 640, "icu": True, "er24": True, "pmjay": True, "nabh": True, "bloodBank": False, "priceIndex": 1.1, "lat": 23.2307, "lon": 77.3663},
    {"id": "rims", "name": "RIMS Ranchi", "cityId": "ranchi", "tier": "Govt Apex", "score": 84, "beds": 980, "icu": True, "er24": True, "pmjay": True, "nabh": False, "bloodBank": True, "priceIndex": 0.24, "lat": 23.3942, "lon": 85.3701},
    {"id": "medica-r", "name": "Bhagwan Mahavir Medica", "cityId": "ranchi", "tier": "Private", "score": 83, "beds": 380, "icu": True, "er24": True, "pmjay": True, "nabh": True, "bloodBank": True, "priceIndex": 1.2, "lat": 23.3572, "lon": 85.3084},
    {"id": "aiims-p", "name": "AIIMS Patna", "cityId": "patna", "tier": "Govt Apex", "score": 86, "beds": 980, "icu": True, "er24": True, "pmjay": True, "nabh": False, "bloodBank": True, "priceIndex": 0.25, "lat": 25.5942, "lon": 85.1061},
    {"id": "paras", "name": "Paras HMRI", "cityId": "patna", "tier": "Private NABH", "score": 84, "beds": 400, "icu": True, "er24": True, "pmjay": True, "nabh": True, "bloodBank": True, "priceIndex": 1.25, "lat": 25.6162, "lon": 85.0995},
    {"id": "sms", "name": "SMS Hospital", "cityId": "jaipur", "tier": "Govt Apex", "score": 88, "beds": 1760, "icu": True, "er24": True, "pmjay": True, "nabh": False, "bloodBank": True, "priceIndex": 0.28, "lat": 26.8994, "lon": 75.7885},
    {"id": "fortis-j", "name": "Fortis Escorts Jaipur", "cityId": "jaipur", "tier": "Private NABH", "score": 85, "beds": 290, "icu": True, "er24": True, "pmjay": False, "nabh": True, "bloodBank": True, "priceIndex": 1.45, "lat": 26.8523, "lon": 75.7643},
]

def hospital_by_id(hid: str) -> dict | None:
    for h in HOSPITALS:
        if h["id"] == hid:
            return h
    return None


# ------------------------------------------------------------------ Providers

PROVIDERS = [
    {
        "id": "pmjay",
        "name": "PM-JAY (Ayushman Bharat)",
        "plans": [
            {"name": "Standard Family Cover", "multiplier": 1},
            {"name": "Senior Citizen Cover", "multiplier": 1.15},
        ],
        "network": [h["id"] for h in HOSPITALS if h["pmjay"]],
    },
    {
        "id": "sbi",
        "name": "SBI General Health",
        "plans": [
            {"name": "Arogya Premier", "multiplier": 1},
            {"name": "Arogya Plus", "multiplier": 1.25},
            {"name": "Super Health Plus", "multiplier": 1.5},
        ],
        "network": ["aiims-d", "safdarjung", "apollo-d", "kem", "kokilaben", "medica-k", "aiims-b", "rims", "aiims-p", "sms", "fortis-j"],
    },
    {
        "id": "hdfc",
        "name": "HDFC Ergo Health",
        "plans": [
            {"name": "Optima Restore", "multiplier": 1},
            {"name": "Optima Secure", "multiplier": 1.3},
        ],
        "network": ["apollo-d", "max-saket", "kokilaben", "medica-k", "chirayu", "medica-r", "paras", "fortis-j"],
    },
    {
        "id": "star",
        "name": "Star Health",
        "plans": [
            {"name": "Family Health Optima", "multiplier": 1},
            {"name": "Senior Citizens Red Carpet", "multiplier": 1.2},
        ],
        "network": ["max-saket", "kokilaben", "medica-k", "chirayu", "paras", "fortis-j", "sms", "aiims-d"],
    },
    {
        "id": "icici",
        "name": "ICICI Lombard",
        "plans": [
            {"name": "Complete Health", "multiplier": 1},
            {"name": "Health Booster", "multiplier": 1.28},
        ],
        "network": ["apollo-d", "max-saket", "kokilaben", "medica-k", "medica-r", "paras", "fortis-j"],
    },
    {
        "id": "niva",
        "name": "Niva Bupa",
        "plans": [
            {"name": "ReAssure", "multiplier": 1},
            {"name": "Health Premia", "multiplier": 1.35},
        ],
        "network": ["apollo-d", "kokilaben", "chirayu", "paras", "fortis-j", "sms"],
    },
]

def provider_by_id(pid: str) -> dict:
    for p in PROVIDERS:
        if p["id"] == pid:
            return p
    return PROVIDERS[1]


# ------------------------------------------------------------------ Diseases

DISEASES = [
    {"id": "dengue",   "nameKey": "Dengue fever",      "base": [18000, 48000, 115000, 220000], "minSeverity": 0, "stages": {"opd": 2, "ipd": 5, "proc": 0, "rehab": 7}},
    {"id": "typhoid",  "nameKey": "Typhoid fever",     "base": [9000, 26000, 60000, 120000],  "minSeverity": 0, "stages": {"opd": 2, "ipd": 4, "proc": 0, "rehab": 6}},
    {"id": "pneumonia","nameKey": "Pneumonia",         "base": [20000, 55000, 120000, 240000], "minSeverity": 0, "stages": {"opd": 2, "ipd": 6, "proc": 0, "rehab": 10}},
    {"id": "cataract", "nameKey": "Cataract surgery",  "base": [14000, 38000, 38000, 42000],   "minSeverity": 0, "stages": {"opd": 1, "ipd": 1, "proc": 1, "rehab": 14}},
    {"id": "knee",     "nameKey": "Knee replacement",  "base": [220000, 220000, 260000, 320000],"minSeverity": 1, "stages": {"opd": 2, "ipd": 5, "proc": 1, "rehab": 42}},
    {"id": "bypass",   "nameKey": "Heart bypass (CABG)","base": [180000, 180000, 260000, 340000],"minSeverity": 1,"stages": {"opd": 2, "ipd": 8, "proc": 1, "rehab": 30}},
    {"id": "delivery", "nameKey": "Delivery (normal)", "base": [12000, 30000, 65000, 120000],  "minSeverity": 0, "stages": {"opd": 3, "ipd": 2, "proc": 1, "rehab": 14}},
    {"id": "dialysis", "nameKey": "Dialysis (monthly)","base": [30000, 60000, 90000, 120000],  "minSeverity": 0, "stages": {"opd": 8, "ipd": 0, "proc": 8, "rehab": 0}},
    {"id": "stroke",  "nameKey": "Stroke management", "base": [160000, 160000, 300000, 520000],"minSeverity": 1, "stages": {"opd": 1, "ipd": 10, "proc": 1, "rehab": 60}},
    {"id": "covid",    "nameKey": "COVID-19 care",     "base": [15000, 45000, 110000, 230000], "minSeverity": 0, "stages": {"opd": 2, "ipd": 7, "proc": 0, "rehab": 14}},
]

SEVERITIES = ["mild", "moderate", "severe", "critical"]
SEVERITY_INDEX = {name: i for i, name in enumerate(SEVERITIES)}

def disease_by_id(did: str) -> dict:
    for d in DISEASES:
        if d["id"] == did:
            return d
    return DISEASES[0]


# ------------------------------------------------------------------ Conditions

CONDITIONS = [
    {"id": "dengue", "nameKey": "Dengue fever", "level": 3, "keywords": ["fever","joint pain","body ache","pain behind eyes","rash","platelet","bone pain","जोड़","जोड़ों","बुखार","চোখ","জ্বর","গা ব্যথা"], "adviceKey": "Push fluids aggressively. Daily platelet monitoring for the next 5 days; hospitalise if bleeding signs or dizziness appear."},
    {"id": "typhoid", "nameKey": "Typhoid fever", "level": 3, "keywords": ["fever","weakness","stomach pain","abdominal","constipation","vomiting","टाइफाइड","पেटে ब्यथा","जी मिचलाना"], "adviceKey": "Blood culture is the gold-standard test. Antibiotics only as prescribed; hydration is critical through week 2."},
    {"id": "covid", "nameKey": "COVID-19 / viral illness", "level": 2, "keywords": ["fever","cough","sore throat","cold","taste","smell","runny nose","सर्दी","गले","কाशি","গলা ব্যথা"], "adviceKey": "Test on day 2-3 of fever. Isolate and monitor oxygen saturation with a pulse oximeter twice daily."},
    {"id": "pneumonia", "nameKey": "Pneumonia", "level": 4, "keywords": ["cough","chest","sputum","rapid breathing","grunting","निमोनिया","নিউমোনিয়া","साँस"], "adviceKey": "Any child with rapid breathing or chest indrawing needs same-day assessment. Adults: watch for oxygen saturation below 92%."},
    {"id": "flu", "nameKey": "Influenza", "level": 2, "keywords": ["fever","chills","body ache","muscle pain","headache","फ्लू","ইনফ্লুয়েঞ্জা"], "adviceKey": "Symptomatic care: paracetamol, fluids, rest. Antivirals help only if started in the first 48 hours."},
    {"id": "gastro", "nameKey": "Acute gastroenteritis", "level": 2, "keywords": ["diarrhoea","diarrhea","loose","stool","vomiting","stomach","दस्त","उल्टी","পায়খানা","বমি"], "adviceKey": "ORS after every loose stool. Danger signs: sunken eyes, no urine for 8 hours, blood in stool — then hospitalise."},
    {"id": "migraine", "nameKey": "Migraine / tension headache", "level": 1, "keywords": ["headache","migraine","sir dard","सिरदर्द","माथा","মাথাব্যথা"], "adviceKey": "Rest in a dark quiet room. Persistent daily headaches for 2+ weeks need an eye and BP check first."},
    {"id": "uti", "nameKey": "Urinary tract infection", "level": 2, "keywords": ["burning","urine","urination","bladder","पेशाब","मूत्र","প্রস্রাব"], "adviceKey": "High fluid intake helps early. Fever with flank pain may mean kidney involvement — needs same-day care."},
    {"id": "asthma", "nameKey": "Asthma exacerbation", "level": 4, "keywords": ["wheeze","wheezing","asthma","inhaler","साँस","दमा","হাঁপানি"], "adviceKey": "Use the reliever inhaler immediately. If relief lasts under 4 hours, or oxygen saturation drops below 90%, seek urgent care."},
    {"id": "dengue-sev", "nameKey": "Severe dengue warning", "level": 4, "keywords": ["bleeding","gums","bruising","blood","platelet","रक्त","রক্তক্ষরণ"], "adviceKey": "Any mucosal bleeding or abdominal pain with fever requires hospitalisation within hours for platelet and haematocrit monitoring."},
    {"id": "cardiac", "nameKey": "Cardiac chest pain", "level": 4, "keywords": ["chest pain","left arm","sweating","palpitation","सीने में दर्द","বুকের ব্যথা"], "adviceKey": "Aspirin 325 mg chewed (if not allergic) and rush to an emergency facility with cath-lab capability. Do not drive yourself."},
    {"id": "stomach", "nameKey": "Gastritis / acid reflux", "level": 1, "keywords": ["acidity","gas","burp","heartburn","एसिडिटी","गैस","অ্যাসিডিটি","গ্যাস"], "adviceKey": "Small frequent meals, avoid late-night eating. If pain radiates to the chest or arm, treat as cardiac until proven otherwise."},
    {"id": "backpain", "nameKey": "Musculoskeletal back pain", "level": 1, "keywords": ["back pain","backache","waist","कमर","पीठ","কোমর","পিঠ"], "adviceKey": "Stay mobile, avoid prolonged bed rest. Red flags: numbness in legs, loss of bowel control — needs urgent review."},
    {"id": "anemia", "nameKey": "Anaemia", "level": 2, "keywords": ["weakness","tired","fatigue","pale","dizzy","कमज़ोरी","दुर्बलता","দুর্বলতা"], "adviceKey": "A haemoglobin test is the first step. Dietary iron and folic acid help while awaiting results."},
    {"id": "diabetes", "nameKey": "Uncontrolled diabetes", "level": 3, "keywords": ["sugar","diabetes","thirst","frequent urination","मधुमेह","शुगर","ডায়াবেটিস"], "adviceKey": "If blood glucose stays above 250 mg/dL or ketones appear, seek same-day care. Skip sugary drinks entirely."},
    {"id": "skin", "nameKey": "Skin infection / rash", "level": 1, "keywords": ["rash","itching","skin","boil","खुजली","त्वचा","চুলকানি","ত্বক"], "adviceKey": "Clean with soap and water; avoid scratching. A spreading red streak or fever with rash means same-day care."},
    {"id": "eye", "nameKey": "Eye infection (conjunctivitis)", "level": 1, "keywords": ["red eye","eye pain","itching","eye discharge","आँख","চোখ"], "adviceKey": "Frequent handwashing; avoid touching eyes. Severe eye pain or vision loss is an emergency, not a routine visit."},
]

LEVEL_NAMES = {1: "Routine", 2: "Prompt", 3: "Urgent", 4: "Emergency"}

CONDITION_TO_DISEASE = {
    "dengue": "dengue", "dengue-sev": "dengue", "typhoid": "typhoid", "covid": "covid",
    "pneumonia": "pneumonia", "cardiac": "bypass", "asthma": "pneumonia", "flu": "covid",
    "gastro": "typhoid", "stroke": "stroke",
}

def disease_for_condition(condition_id: str) -> str:
    return CONDITION_TO_DISEASE.get(condition_id, "pneumonia")


# ------------------------------------------------------------------ Red flags

RED_FLAGS = [
    {"id": "chest",   "labelKey": "Chest pain or crushing pressure", "hintKey": "Pain spreading to arm, jaw or back"},
    {"id": "breath",  "labelKey": "Severe breathlessness at rest",   "hintKey": "Cannot finish a sentence in one breath"},
    {"id": "stroke",  "labelKey": "Face droop / arm weakness / slurred speech", "hintKey": "Sudden onset — FAST signs"},
    {"id": "blood",   "labelKey": "Coughing or vomiting blood",      "hintKey": "Any quantity, fresh blood"},
    {"id": "collapse","labelKey": "Fainting or unresponsiveness",    "hintKey": "Loss of consciousness this week"},
    {"id": "preg",    "labelKey": "Pregnancy with bleeding or seizures", "hintKey": "Any trimester"},
    {"id": "burn",    "labelKey": "Severe burn or electrocution",     "hintKey": "Blistered burns larger than a palm"},
    {"id": "poison",  "labelKey": "Suspected poisoning or overdose",  "hintKey": "Pesticide, chemicals, medicines"},
]


# ------------------------------------------------------------------ Schemes

SchemeMatchFn = Callable[[dict], int]

def _pmjay_match(p: dict) -> int:
    s = 0
    if p["income"] == 0: s = 94
    elif p["income"] == 1 and p["category"] in ("cat.obc", "cat.sc", "cat.st"): s = 72
    elif p["income"] == 1: s = 58
    elif p["work"] == "work.daily": s = 64
    elif p["work"] == "work.self": s = 34
    if p["category"] in ("cat.sc", "cat.st"): s = max(s, 88)
    if p["category"] == "cat.rural": s = max(s, 76)
    return min(s, 97)

def _cghs_match(p: dict) -> int:
    return 95 if p["work"] in ("work.gov", "work.pension") else 4

def _esic_match(p: dict) -> int:
    if p["work"] == "work.pvt": return 90
    if p["work"] == "work.daily": return 22
    return 6

def _jsy_match(p: dict) -> int:
    if p["need"] != "need.preg": return 0
    return 92 if p["income"] == 0 else 84 if p["income"] == 1 else 60

def _pmndp_match(p: dict) -> int:
    if p["need"] != "need.dialysis": return 0
    return 93 if p["income"] <= 1 else 74

def _hmdg_match(p: dict) -> int:
    if p["need"] != "need.critical": return 0
    return 86 if p["income"] == 0 else 54 if p["income"] == 1 else 0

def _chiranjeevi_match(p: dict) -> int:
    if p["state"] != "RJ": return 0
    return 91 if p["income"] <= 2 else 68

def _wbhs_match(p: dict) -> int:
    if p["state"] != "WB": return 5
    return 89 if p["work"] in ("work.gov", "work.pension") else 5

SCHEMES: list[dict] = [
    {"id": "pmjay",       "name": "Ayushman Bharat PM-JAY",       "short": "PM-JAY", "type": "National", "benefit": "₹5 lakh family floater per year, cashless at empanelled hospitals. All pre-existing diseases covered from day one.", "docs": "PM-JAY golden card (SECC-linked), Aadhaar, ration card.", "require": None, "match": _pmjay_match},
    {"id": "cghs",        "name": "Central Government Health Scheme","short": "CGHS",  "type": "National", "benefit": "Full outpatient and inpatient care at CGHS empanelled hospitals for serving and retired central government staff.", "docs": "CGHS card, department ID or pension order.", "require": None, "match": _cghs_match},
    {"id": "esic",        "name": "Employees' State Insurance Scheme","short": "ESIC", "type": "National", "benefit": "Complete medical care plus 70% wage compensation during sick leave for workers earning under ₹21,000/month.", "docs": "ESIC pehchan card, employer contribution record.", "require": None, "match": _esic_match},
    {"id": "jsy",         "name": "Janani Suraksha Yojana",       "short": "JSY",    "type": "National", "benefit": "Cash assistance for institutional delivery plus free transport to the facility, focused on rural and low-income mothers.", "docs": "Mother & child protection card (MCP), Aadhaar.", "require": "need", "match": _jsy_match},
    {"id": "pmndp",       "name": "PM National Dialysis Programme","short": "PMNDP",  "type": "National", "benefit": "Free maintenance dialysis sessions at district hospital dialysis units, funded under NHM.", "docs": "Nephrologist referral, BPL / EWS certificate where applicable.", "require": "need", "match": _pmndp_match},
    {"id": "hmdg",        "name": "Health Minister's Discretionary Grant","short": "HMDG","type": "National","benefit": "One-time financial assistance (up to ₹1.25 lakh) for critical illness treatment for families below poverty line.", "docs": "BPL certificate, critical-illness diagnosis, estimated treatment quote.", "require": "need", "match": _hmdg_match},
    {"id": "chiranjeevi", "name": "Chiranjeevi Swasthya Bima Yojana","short": "CSBY",  "type": "State",    "benefit": "₹25 lakh family floater cashless cover for all Rajasthan families, at empanelled public and private hospitals.", "docs": "Aadhaar-linked family registration on the state portal.", "require": "state", "match": _chiranjeevi_match},
    {"id": "wbhs",        "name": "West Bengal Health Scheme",     "short": "WBHS",   "type": "State",    "benefit": "Full cashless treatment for state government employees and pensioners at recognised hospitals across India.", "docs": "Service book or pension payment order, WBHS card.", "require": "state", "match": _wbhs_match},
]

INDIAN_STATES = ["DL","MH","WB","MP","JH","BR","RJ","UP","KA","TN","GJ","OR"]


# ------------------------------------------------------------------ ASHA workers

ASHA_WORKERS = [
    {"id": "asha-1", "name": "Anjali Devi",   "village": "Rampur Village", "district": "South Delhi",       "cityId": "delhi",  "years": 8,  "languages": ["Hindi","English"],          "lat": 28.52, "lon": 77.19},
    {"id": "asha-2", "name": "Rekha Kumari",   "village": "Laxmi Nagar",    "district": "East Delhi",       "cityId": "delhi",  "years": 12, "languages": ["Hindi"],                    "lat": 28.63, "lon": 77.28},
    {"id": "asha-3", "name": "Mitali Roy",     "village": "Sonarpur",      "district": "South 24 Parganas", "cityId": "kolkata","years": 6,  "languages": ["Bengali","Hindi"],          "lat": 22.44, "lon": 88.43},
    {"id": "asha-4", "name": "Priya Sharma",   "village": "Kolar Road",    "district": "Bhopal",            "cityId": "bhopal", "years": 9,  "languages": ["Hindi"],                    "lat": 23.21, "lon": 77.4},
    {"id": "asha-5", "name": "Meena Oraon",    "village": "Hatia",         "district": "Ranchi",            "cityId": "ranchi", "years": 7,  "languages": ["Hindi","Santhali"],         "lat": 23.33, "lon": 85.31},
]


# ------------------------------------------------------------------ Geometry

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))

_MAP_BOUNDS = {"minLon": 68, "maxLon": 97, "minLat": 8, "maxLat": 37}

def project(lat: float, lon: float, w: int = 1000, h: int = 620) -> dict:
    x = ((lon - _MAP_BOUNDS["minLon"]) / (_MAP_BOUNDS["maxLon"] - _MAP_BOUNDS["minLon"])) * w
    y = ((_MAP_BOUNDS["maxLat"] - lat) / (_MAP_BOUNDS["maxLat"] - _MAP_BOUNDS["minLat"])) * h
    return {"x": round(x), "y": round(y)}


def inr(n: float) -> str:
    return "₹" + f"{round(n):,}"


def eta_minutes(km: float, city_id: str) -> int:
    traffic = 1
    for c in CITIES:
        if c["id"] == city_id:
            traffic = c["traffic"]
            break
    return max(6, round((km / 38) * 60 * traffic))
