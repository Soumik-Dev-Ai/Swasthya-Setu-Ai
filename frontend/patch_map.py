import re

with open('src/components/MapView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '<div className="relative" style={{ width: "100%", height: "520px", borderRadius: "6px", overflow: "hidden" }}>',
    '<div className="relative h-[400px] lg:h-[520px] w-full overflow-hidden rounded-[6px]">'
)

content = content.replace('height={520}', '')

with open('src/components/MapView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
