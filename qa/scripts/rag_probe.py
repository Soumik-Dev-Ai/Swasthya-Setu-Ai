#!/usr/bin/env python3
"""Phase 2c — what is the knowledge base actually running on? The audit reports an in-process JSON-vector retriever
with a default 'hash' embedding. That contradicts the locked decision (pgvector + HNSW on Neon, doc 22). Hash embeddings
match tokens, not meaning, so the real question is retrieval quality on paraphrases."""
import json, requests
from common import API, env, record

dsn = env("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://"); info = {}
try:
    if dsn.startswith("sqlite"):
        import sqlite3; c = sqlite3.connect(dsn.split("///")[-1]); cur = c.cursor()
        cur.execute("select name from sqlite_master where name ilike '%chunk%'" .replace("ilike", "like")); info["tables"] = [r[0] for r in cur.fetchall()]
        info["pgvector"] = False; info["engine"] = "sqlite"
    elif dsn:
        try: import psycopg2 as pg
        except ImportError: import psycopg as pg  # type: ignore
        cur = pg.connect(dsn).cursor()
        cur.execute("select count(*) from pg_extension where extname='vector'"); info["pgvector"] = cur.fetchone()[0] > 0
        cur.execute("select table_name,column_name,udt_name from information_schema.columns where column_name ilike '%embed%'"); info["embedding_columns"] = cur.fetchall()
        cur.execute("select indexdef from pg_indexes where indexdef ilike '%hnsw%' or indexdef ilike '%ivfflat%'"); info["ann_indexes"] = [r[0] for r in cur.fetchall()]
        info["engine"] = "postgres"
except Exception as e:  # noqa
    info["error"] = str(e)
info["embedding_env"] = {k: env(k) for k in ("EMBEDDING_BACKEND", "EMBEDDING_MODEL")}
ok = info.get("pgvector") and any("vector" in str(c[2]) for c in info.get("embedding_columns", []))
record("P2-RAG-VECTORSTORE", "Knowledge base uses pgvector with an ANN index (locked decision, docs 14/22)", "PASS" if ok and info.get("ann_indexes") else "FAIL" if "error" not in info else "BLOCKED",
       {**info, "note": "FAIL = in-process JSON vectors. Not a safety bug by itself (and Neon's free tier means cost was not a valid reason), but it departs from the locked architecture: decide deliberately and update the docs, or migrate."})

# Semantic probe: paraphrases sharing NO keywords with guideline wording should still retrieve a grounded answer.
field = env("TRIAGE_TEXT_FIELD", "symptoms"); extra = json.loads(env("TRIAGE_EXTRA_JSON", '{"flags": [], "reasoning": true}'))
probes = ["my little one has been burning up for several days and keeps hacking without bringing anything up",
          "stomach keeps emptying out as watery stuff since the morning and he is weak",
          "her skin and the whites of her eyes have turned yellow this week"]
def grounded(o):
    if isinstance(o, dict): return any((k.lower().startswith("grounding") and v) or grounded(v) for k, v in o.items())
    if isinstance(o, list): return any(grounded(x) for x in o)
    return False
res = []
for q in probes:
    try:
        r = requests.post(API + env("TRIAGE_PATH", "/api/triage/analyze"), json={field: q, **extra}, timeout=60); res.append({"q": q, "status": r.status_code, "grounded": grounded(r.json())})
    except Exception as e: res.append({"q": q, "error": str(e)})
n = sum(1 for r in res if r.get("grounded"))
record("P2-RAG-SEMANTIC", "Retrieval grounds paraphrased symptoms that share no keywords with the guidelines", "PASS" if n == len(probes) else "FAIL" if n == 0 else "PARTIAL",
       {"groundedOf": f"{n}/{len(probes)}", "results": res, "caveat": "3 probes is a smoke test. Extend with a labelled paraphrase set before claiming retrieval quality; abstention on a truly absent topic is correct, so check results by hand."})
