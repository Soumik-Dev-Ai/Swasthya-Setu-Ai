import re

with open('src/pages/Insurance.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'<select\s+value=\{providerId\}\s+onChange=\{\(e\) => \{\s*setProviderId\(e\.target\.value\);\s*setPlan\(providerById\(e\.target\.value\)\.plans\[0\]\.name\);\s*\}\}\s+className="field"\s+style=\{font\}\s*>\s*\{PROVIDERS\.map\(\(p\) => \(\s*<option key=\{p\.id\} value=\{p\.id\}>\s*\{p\.name\}\s*<\/option>\s*\)\)\}\s*<\/select>',
    r'<SearchSelect value={providerId} onChange={(val) => { setProviderId(val); setPlan(providerById(val).plans[0].name); }} options={PROVIDERS.map(p => ({ value: p.id, label: p.name }))} />',
    content,
    flags=re.MULTILINE
)

with open('src/pages/Insurance.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
