import re

with open('src/pages/Cost.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix severity options in Cost.tsx
def map_sev(match):
    return r'<SearchSelect value={severity} onChange={(v) => setSeverity(v as Severity)} options={[{value: "mild", label: t("cost.treat.sev.mild")}, {value: "moderate", label: t("cost.treat.sev.mod")}, {value: "severe", label: t("cost.treat.sev.sev")}, {value: "critical", label: t("cost.treat.sev.crit")}]} />'

content = re.sub(
    r'<SearchSelect value=\{severity\}.*?/>',
    map_sev,
    content
)

with open('src/pages/Cost.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
