import re

with open('src/pages/Triage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'<div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">.*?<span className="text-\[10px\] tracking-wider text-mist/50">\{symptoms\.length\}</span>\s*</div>',
    r'''<div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <div></div>
                  <span className="text-[10px] tracking-wider text-mist/50">{symptoms.length}</span>
                </div>''',
    content,
    flags=re.DOTALL
)

with open('src/pages/Triage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
