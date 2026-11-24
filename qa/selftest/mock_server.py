#!/usr/bin/env python3
"""Tiny mock of the system under test, used ONLY to prove the harness can both PASS and FAIL.
  python3 mock_server.py bypass     -> frontend calls /v3/intent only, no grounding, landing has hard-coded stats
  python3 mock_server.py compliant  -> frontend calls /api/triage/analyze, returns grounding_reference
The mock only understands a few ENGLISH emergency keywords, so the multilingual corpus MUST show false negatives."""
import json, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODE = sys.argv[1] if len(sys.argv) > 1 else "compliant"
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765
RED = ("chest pain", "cannot breathe", "can't breathe", "seizure", "bleeding heavily", "face drooping", "kerosene", "crushing")

PAGE_TRIAGE = """<!doctype html><html><body><main><h1>Triage</h1>
<textarea id=t aria-label="symptoms"></textarea><button onclick="go()">Analyze</button><div id=out></div></main>
<script>
async function go(){
  const text=document.getElementById('t').value;
  const url = '%s';
  const r = await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text})});
  const j = await r.json();
  const o=document.getElementById('out');
  if(j.level===4){o.innerHTML='<b>Level 4 EMERGENCY</b> <a href="tel:108">Call 108</a> <a href="https://www.google.com/maps/dir/?api=1&destination=22.5,88.3">Directions</a>';}
  else o.textContent=JSON.stringify(j);
}
</script></body></html>"""

PAGE_HOME = """<!doctype html><html><body><main><h1>SwasthyaSetu</h1><p>Serving 1,234 facilities and 5,678 ASHA workers</p></main></body></html>"""


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):  # quiet
        pass

    def _send(self, code, body, ctype="application/json"):
        data = body.encode() if isinstance(body, str) else body
        self.send_response(code); self.send_header("content-type", ctype); self.send_header("content-length", str(len(data))); self.end_headers(); self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith("/health"): return self._send(200, '{"ok":true}')
        if self.path.startswith("/triage"):
            target = "/v3/intent" if MODE == "bypass" else "/api/triage/analyze"
            return self._send(200, PAGE_TRIAGE % target, "text/html")
        if self.path == "/" : return self._send(200, PAGE_HOME, "text/html")
        return self._send(404, "{}")

    def do_POST(self):
        n = int(self.headers.get("content-length", 0)); body = json.loads(self.rfile.read(n) or b"{}")
        text = (body.get("text") or "").lower()
        red = any(k in text for k in RED)
        if self.path == "/v3/intent":
            return self._send(200, json.dumps({"intent": "symptom", "level": 4 if red else 1}))
        if self.path == "/api/triage/analyze":
            out = {"level": 4 if red else 2, "advice": "rest and fluids", "grounding_reference": None if red else "imci-ch3-p12"}
            return self._send(200, json.dumps(out))
        return self._send(404, "{}")


ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
