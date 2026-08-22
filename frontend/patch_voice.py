import re

with open('src/pages/Triage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the button element that has onPointerDown={startVoice}
content = re.sub(r'<button\s+type="button"\s+onPointerDown=\{startVoice\}[^>]+>.*?<\/button>', '', content, flags=re.DOTALL)

# Remove the AnimatePresence for voiceNote
content = re.sub(r'<AnimatePresence>\s*\{voiceNote && \([\s\S]*?<\/AnimatePresence>', '', content)

with open('src/pages/Triage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
