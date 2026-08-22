import markdown
import os

files_to_convert = [
    (r"C:\Users\user\.gemini\antigravity\brain\3e3946b8-a9ae-431d-a687-f3cdabde89f1\walkthrough.md", "SwasthaSetu_Project_Walkthrough.html"),
    (r"C:\Users\user\.gemini\antigravity\brain\3e3946b8-a9ae-431d-a687-f3cdabde89f1\backend_production_report.md", "SwasthaSetu_Backend_Production_Report.html")
]

HTML_TEMPLATE = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    line-height: 1.6;
    color: #24292e;
    background-color: #fff;
    max-width: 900px;
    margin: 0 auto;
    padding: 40px;
  }}
  h1, h2, h3, h4, h5, h6 {{
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: 600;
    line-height: 1.25;
  }}
  h1 {{ font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: .3em; }}
  h2 {{ font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: .3em; }}
  code {{
    padding: .2em .4em;
    margin: 0;
    font-size: 85%;
    background-color: rgba(27,31,35,.05);
    border-radius: 3px;
    font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
  }}
  pre {{
    padding: 16px;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: #f6f8fa;
    border-radius: 3px;
  }}
  pre code {{ background-color: transparent; padding: 0; }}
  blockquote {{
    padding: 0 1em;
    color: #6a737d;
    border-left: .25em solid #dfe2e5;
    margin: 0;
  }}
  table {{
    border-spacing: 0;
    border-collapse: collapse;
    margin-bottom: 16px;
  }}
  table th, table td {{
    padding: 6px 13px;
    border: 1px solid #dfe2e5;
  }}
  table tr:nth-child(2n) {{ background-color: #f6f8fa; }}
</style>
</head>
<body>
{content}
</body>
</html>'''

for md_path, out_name in files_to_convert:
    if os.path.exists(md_path):
        with open(md_path, 'r', encoding='utf-8') as f:
            md_content = f.read()
        
        html_body = markdown.markdown(md_content, extensions=['fenced_code', 'tables'])
        
        title = out_name.replace('.html', '').replace('_', ' ')
        final_html = HTML_TEMPLATE.format(title=title, content=html_body)
        
        out_path = os.path.join(os.getcwd(), out_name)
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(final_html)
        print(f"Created {out_path}")
    else:
        print(f"File not found: {md_path}")
