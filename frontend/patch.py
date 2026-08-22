import os, re

def patch_file(file):
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'SearchSelect' not in content:
        content = content.replace('import { useEffect', 'import { SearchSelect } from "../components/SearchSelect";\nimport { useEffect')

    # Facilities: City
    content = re.sub(
        r'<select value=\{cityId\} onChange=\{\(e\) => setCityId\(e\.target\.value\)\} className="field">\s*\{CITIES\.map\(\(c\) => \(\s*<option key=\{c\.id\} value=\{c\.id\}>\s*\{c\.nameKey\}\s*<\/option>\s*\)\)\}\s*<\/select>',
        r'<SearchSelect value={cityId} onChange={setCityId} options={CITIES.map(c => ({ value: c.id, label: c.nameKey }))} />',
        content
    )

    # Triage: User City
    content = re.sub(
        r'<select value=\{userCity\} onChange=\{\(e\) => setUserCity\(e\.target\.value\)\} className="field" style=\{font\}>\s*\{CITIES\.map\(\(c\) => \(\s*<option key=\{c\.id\} value=\{c\.id\}>\s*\{c\.nameKey\}\s*<\/option>\s*\)\)\}\s*<\/select>',
        r'<SearchSelect value={userCity} onChange={setUserCity} options={CITIES.map(c => ({ value: c.id, label: c.nameKey }))} />',
        content
    )

    # Triage: Aff City
    content = re.sub(
        r'<select value=\{affCity\} onChange=\{\(e\) => setAffCity\(e\.target\.value\)\} className="field" style=\{font\}>\s*\{CITIES\.map\(\(c\) => \(\s*<option key=\{c\.id\} value=\{c\.id\}>\s*\{c\.nameKey\}\s*<\/option>\s*\)\)\}\s*<\/select>',
        r'<SearchSelect value={affCity} onChange={setAffCity} options={CITIES.map(c => ({ value: c.id, label: c.nameKey }))} />',
        content
    )

    # Cost: City
    content = re.sub(
        r'<select\s*value=\{city\}\s*onChange=\{\(e\) => setCity\(e\.target\.value\)\}\s*className="field"\s*style=\{font\}\s*>\s*<option value="">\{t\("cost\.treat\.city_all"\)\}<\/option>\s*\{CITIES\.map\(\(c\) => \(\s*<option key=\{c\.id\} value=\{c\.id\}>\s*\{c\.nameKey\}\s*<\/option>\s*\)\)\}\s*<\/select>',
        r'<SearchSelect value={city} onChange={setCity} options={[{value: "", label: t("cost.treat.city_all")}, ...CITIES.map(c => ({ value: c.id, label: c.nameKey }))]} />',
        content
    )

    # Cost: Disease
    content = re.sub(
        r'<select\s*value=\{disease\}\s*onChange=\{\(e\) => setDisease\(e\.target\.value\)\}\s*className="field"\s*style=\{font\}\s*>\s*\{DISEASES\.map\(\(d\) => \(\s*<option key=\{d\.id\} value=\{d\.id\}>\s*\{t\(d\.nameKey\)\}\s*<\/option>\s*\)\)\}\s*<\/select>',
        r'<SearchSelect value={disease} onChange={setDisease} options={DISEASES.map(d => ({ value: d.id, label: t(d.nameKey) }))} />',
        content
    )

    # Cost: Severity
    content = re.sub(
        r'<select\s*value=\{severity\}\s*onChange=\{\(e\) => setSeverity\(e\.target\.value as Severity\)\}\s*className="field"\s*style=\{font\}\s*>\s*\{SEVERITIES\.map\(\(s\) => \(\s*<option key=\{s\} value=\{s\}>\s*\{t\("common\.sev\." \+ s\)\}\s*<\/option>\s*\)\)\}\s*<\/select>',
        r'<SearchSelect value={severity} onChange={(v) => setSeverity(v as Severity)} options={SEVERITIES.map(s => ({ value: s, label: t("common.sev." + s) }))} />',
        content
    )
    
    # Cost: Hospital
    content = re.sub(
        r'<select\s*value=\{hospital\}\s*onChange=\{\(e\) => setHospital\(e\.target\.value\)\}\s*className="field"\s*style=\{font\}\s*>\s*<option value="">\{t\("cost\.treat\.hosp_any"\)\}<\/option>\s*\{cityHospitals\.map\(\(h\) => \(\s*<option key=\{h\.id\} value=\{h\.id\}>\s*\{h\.name\}\s*<\/option>\s*\)\)\}\s*<\/select>',
        r'<SearchSelect value={hospital} onChange={setHospital} options={[{value: "", label: t("cost.treat.hosp_any")}, ...cityHospitals.map(h => ({ value: h.id, label: h.name }))]} />',
        content
    )

    # Insurance: Provider
    content = re.sub(
        r'<select value=\{provider\} onChange=\{\(e\) => setProvider\(e\.target\.value\)\} className="field">\s*<option value="">Select Provider<\/option>\s*\{PROVIDERS\.map\(\(p\) => \(\s*<option key=\{p\.id\} value=\{p\.id\}>\s*\{p\.name\}\s*<\/option>\s*\)\)\}\s*<\/select>',
        r'<SearchSelect value={provider} onChange={setProvider} options={[{value: "", label: "Select Provider"}, ...PROVIDERS.map(p => ({ value: p.id, label: p.name }))]} />',
        content
    )

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

for f in ['src/pages/Facilities.tsx', 'src/pages/Triage.tsx', 'src/pages/Cost.tsx', 'src/pages/Insurance.tsx']:
    patch_file(f)
