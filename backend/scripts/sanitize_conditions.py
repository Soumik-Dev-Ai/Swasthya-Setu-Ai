"""Phase-7 audit item 4 remediation: sanitize remaining named-diagnosis
nameKeys in v2_data.CONDITIONS to clinical finding language (doc 04 §2),
plus the one borderline supplement-advice string. Idempotent-safe: every
anchor must be unique or the script aborts."""
import io
import re

P = "app/services/v2_data.py"
src = io.open(P, encoding="utf-8").read()

# Item 4 targets the triage CONDITIONS block only — the DISEASES catalog
# (cost engine, line ~132) legitimately names procedures for pricing lookup.
COND_ANCHOR = "CONDITIONS = ["
head, cond = src.split(COND_ANCHOR, 1)

subs = [
    ('"nameKey": "COVID-19 / viral illness"', '"nameKey": "Acute respiratory / viral illness"'),
    ('"nameKey": "Pneumonia"', '"nameKey": "Chest infection with rapid breathing"'),
    ('"nameKey": "Influenza"', '"nameKey": "Acute febrile viral illness"'),
    ('"nameKey": "Acute gastroenteritis"', '"nameKey": "Acute diarrhoeal illness"'),
    ('"nameKey": "Migraine / tension headache"', '"nameKey": "Recurring headache pattern"'),
    ('"nameKey": "Urinary tract infection"', '"nameKey": "Burning urination / urinary symptoms"'),
    ('"nameKey": "Asthma exacerbation"', '"nameKey": "Recurrent wheeze / breathlessness"'),
    ('"nameKey": "Severe dengue warning"', '"nameKey": "Bleeding tendency with fever"'),
    ('"nameKey": "Gastritis / acid reflux"', '"nameKey": "Acidity / upper abdominal discomfort"'),
    ('"nameKey": "Anaemia"', '"nameKey": "Weakness / possible low haemoglobin"'),
    ('"nameKey": "Uncontrolled diabetes"', '"nameKey": "High blood sugar symptoms"'),
    ('"nameKey": "Skin infection / rash"', '"nameKey": "Skin rash / localized skin problem"'),
    ('"nameKey": "Eye infection (conjunctivitis)"', '"nameKey": "Red / sticky eyes (possible eye infection)"'),
    ("Dietary iron and folic acid help while awaiting results.", "Iron-rich foods help while awaiting results."),
]

for old, new in subs:
    n = cond.count(old)
    if n != 1:
        raise SystemExit(f"anchor not unique ({n}): {old!r}")
    cond = cond.replace(old, new)

src = head + COND_ANCHOR + cond
io.open(P, "w", encoding="utf-8", newline="").write(src)
print(f"sanitized {len(subs)} entries")

names = re.findall(r'"nameKey": "([^"]+)"', cond)
print("remaining CONDITIONS nameKeys:")
for n in names:
    print(" -", n)
