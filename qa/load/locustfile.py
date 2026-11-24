"""Phase 7 load model. Mixed traffic: red-flag (deterministic gate path) + ambiguous (LLM cascade path).
Red-flag and ambiguous requests are recorded under SEPARATE names so load/analyze.py can prove the deterministic
path is not being queued behind slow LLM calls. 429 is treated as a valid, expected response when the limiter is on."""
import json, os, random
from locust import HttpUser, task, tag, between

PATH = os.environ.get("TRIAGE_PATH", "/api/triage/analyze")
FIELD = os.environ.get("TRIAGE_TEXT_FIELD", "symptoms")
EXTRA = json.loads(os.environ.get("TRIAGE_EXTRA_JSON", '{"flags": [], "reasoning": true}'))
RED = ["severe chest pain radiating to left arm and sweating", "cannot breathe and lips turning blue",
       "child having seizure and unresponsive", "heavy bleeding that will not stop after delivery"]
AMBIG = ["fever for 4 days, dry cough, mild fatigue", "loose motions since yesterday, no blood", "headache and body ache for two days",
         "itchy rash on both arms", "mild stomach pain after meals"]
EXPECT_429 = os.environ.get("EXPECT_429", "1") == "1"


class Citizen(HttpUser):
    wait_time = between(0.2, 1.0)
    host = os.environ.get("API_BASE", "http://127.0.0.1:8000")

    def on_start(self):
        from requests.adapters import HTTPAdapter
        adapter = HTTPAdapter(pool_connections=100, pool_maxsize=100, pool_block=False)
        self.client.mount("http://", adapter)
        self.client.mount("https://", adapter)

    def _post(self, name, text):
        with self.client.post(PATH, json={FIELD: text, **EXTRA}, name=name, catch_response=True) as r:
            if r.status_code == 429:
                # Rejections are near-instant and would drag p95 down, hiding real latency: record them
                # under their own name so triage_* stats contain ONLY requests that were actually served.
                r.request_meta["name"] = name + "_429"
                r.success() if EXPECT_429 else r.failure("429 (limiter hit)")
            elif r.status_code >= 500:
                r.failure(f"{r.status_code}")
            else:
                r.success()

    @tag("redflag_only")
    @task(1)
    def red_flag(self):
        self._post("triage_redflag", random.choice(RED))

    @task(3)
    def ambiguous(self):
        self._post("triage_ambiguous", random.choice(AMBIG))
