"""Shared helpers for the python phases: env config + the same evidence format the Playwright specs write."""
import json, os, time, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
RESULTS = ROOT / "results"
env_qa = ROOT / ".env.qa"
if env_qa.exists():
    for line in env_qa.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.split("#")[0].strip()
            if k not in os.environ:
                os.environ[k] = v

API = os.environ.get("API_BASE", "http://localhost:8000").rstrip("/")


def env(k, d=""):
    v = os.environ.get(k)
    return v if v not in (None, "") else d


def record(id, claim, status, evidence):
    """status: PASS | FAIL | PARTIAL | BLOCKED  (BLOCKED = could not execute; never counted as pass)"""
    assert status in ("PASS", "FAIL", "PARTIAL", "BLOCKED"), status
    RESULTS.mkdir(parents=True, exist_ok=True)
    (RESULTS / "evidence").mkdir(exist_ok=True)
    row = {"id": id, "claim": claim, "status": status, "evidence": evidence,
           "ts": time.strftime("%Y-%m-%dT%H:%M:%S")}
    with open(RESULTS / "results.jsonl", "a") as f:
        f.write(json.dumps(row, default=str) + "\n")
    (RESULTS / "evidence" / f"{id}.json").write_text(json.dumps(row, indent=2, default=str))
    print(f"[{status}] {id}")


def pct(xs, p):
    xs = sorted(xs)
    if not xs:
        return None
    k = min(len(xs) - 1, int(round((p / 100) * (len(xs) - 1))))
    return xs[k]
