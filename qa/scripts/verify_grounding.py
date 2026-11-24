#!/usr/bin/env python3
"""Phase 2b — does the grounding_reference returned in Flow 2 point at a REAL retrieved chunk?
A reference string that exists in the response but not in the knowledge base is a fabricated citation."""
import json, os
from common import RESULTS, env, record

CLAIM = "grounding_reference returned by triage traces to a real chunk in the knowledge base"
src = RESULTS / "flow2_grounding.json"
if not src.exists():
    record("P2-FLOW2-GROUNDING-REAL", CLAIM, "BLOCKED", {"why": "flow2_grounding.json missing (P2 did not run)"}); raise SystemExit
data = json.loads(src.read_text())
refs = [g["value"] for g in data.get("grounding", [])]
if not refs:
    record("P2-FLOW2-GROUNDING-REAL", CLAIM, "FAIL", {"why": "No grounding reference was returned at all (see P2-FLOW2-ENDPOINTS)"}); raise SystemExit

try:
    import psycopg2 as pg
except ImportError:
    try:
        import psycopg as pg  # type: ignore
    except ImportError:
        record("P2-FLOW2-GROUNDING-REAL", CLAIM, "BLOCKED", {"why": "pip install psycopg2-binary", "refs": refs}); raise SystemExit

dsn = env("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")
if not dsn:
    record("P2-FLOW2-GROUNDING-REAL", CLAIM, "BLOCKED", {"why": "DATABASE_URL not set", "refs": refs}); raise SystemExit

conn = pg.connect(dsn); cur = conn.cursor()
cur.execute("""select table_name, column_name from information_schema.columns
               where table_schema='public' and (table_name ilike '%chunk%' or table_name ilike '%document%' or table_name ilike '%rag%')
               and data_type in ('text','character varying')""")
cols = cur.fetchall()
flat = []
for r in refs:
    flat += [str(x) for x in (r if isinstance(r, list) else [r])]
flat = [json.dumps(x) if isinstance(x, (dict, list)) else x for x in flat]
found, searched = {}, set()
for ref in flat:
    needle = ref.strip()[:120]
    for t, c in cols:
        searched.add(f"{t}.{c}")
        cur.execute(f'select count(*) from "{t}" where "{c}" ilike %s', (f"%{needle}%",))
        if cur.fetchone()[0]:
            found.setdefault(ref, []).append(f"{t}.{c}")
missing = [r for r in flat if r not in found]
record("P2-FLOW2-GROUNDING-REAL", CLAIM, "PASS" if not missing else "FAIL",
       {"references": flat, "foundIn": found, "notFound": missing, "columnsSearched": sorted(searched),
        "note": "If columns searched is empty or the ref format is an ID, point this script at the actual chunk table/key column."})
