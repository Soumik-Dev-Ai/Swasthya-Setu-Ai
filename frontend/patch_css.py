import re

with open('src/index.css', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'font-size: 0.875rem;', 'font-size: 16px;', content)

with open('src/index.css', 'w', encoding='utf-8') as f:
    f.write(content)
