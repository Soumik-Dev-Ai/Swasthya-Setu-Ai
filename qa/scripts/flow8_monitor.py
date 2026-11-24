#!/usr/bin/env python3
"""Flow 8 — autonomous source monitor (doc 26). Not drivable through the UI: verified against the watched_sources table.
Invariant under test: a detected change whose verification is ambiguous must land in needs_manual_confirmation and
must NOT alter the published financial data. Steps: snapshot -> trigger monitor -> snapshot -> diff."""
import hashlib, json, subprocess
from common import env, record

ID, CLAIM = "P4-F8-MONITOR", "Source monitor routes ambiguous changes to needs_manual_confirmation and never silently publishes"
try:
    import psycopg2 as pg
except ImportError:
    try:
        import psycopg as pg  # type: ignore
    except ImportError:
        record(ID, CLAIM, "BLOCKED", {"why": "pip install psycopg2-binary"}); raise SystemExit
dsn, trig = env("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://"), env("MONITOR_TRIGGER_CMD")
if not dsn or not trig:
    record(ID, CLAIM, "BLOCKED", {"why": "Set DATABASE_URL and MONITOR_TRIGGER_CMD (e.g. 'cd ../backend && python -m app.etl.run_monitor --once') in .env.qa. Use a QA database, never production."}); raise SystemExit

conn = pg.connect(dsn); conn.autocommit = True; cur = conn.cursor()
cur.execute("select to_regclass('public.watched_sources')")
if cur.fetchone()[0] is None:
    record(ID, CLAIM, "FAIL", {"why": "watched_sources table does not exist: doc 26's unified registry is not implemented"}); raise SystemExit
cur.execute("select column_name from information_schema.columns where table_name='watched_sources' order by ordinal_position")
cols = [c[0] for c in cur.fetchall()]
status_col = next((c for c in cols if c in ("status", "state", "last_status", "verification_status")), None)
pub_table = env("PUBLISHED_TABLE", "")   # the deterministic financial lookup table (e.g. scheme_rates / procedure_costs)


def snap():
    cur.execute("select * from watched_sources order by 1")
    rows = cur.fetchall()
    pub = None
    if pub_table:
        cur.execute(f'select md5(string_agg(t::text, \'\' order by t::text)) from "{pub_table}" t'); pub = cur.fetchone()[0]
    return rows, pub


before, pub_before = snap()
r = subprocess.run(trig, shell=True, capture_output=True, text=True, timeout=1800)
after, pub_after = snap()
changed = [(b, a) for b, a in zip(before, after) if b != a]
si = cols.index(status_col) if status_col else None
states_after = sorted({str(a[si]) for _, a in changed}) if si is not None else []
silent_publish = pub_table and pub_before != pub_after and "needs_manual_confirmation" in {str(a[si]) for a in after} if si is not None else None
record(ID, CLAIM, "PARTIAL", {
    "triggerRc": r.returncode, "triggerTail": (r.stdout + r.stderr)[-500:], "columns": cols, "statusColumn": status_col,
    "rowsChanged": len(changed), "statesAfterTrigger": states_after,
    "publishedTable": pub_table or "(unset: cannot prove no silent publish)",
    "publishedTableChanged": None if not pub_table else pub_before != pub_after,
    "needsManualConfirmationRows": sum(1 for a in after if si is not None and str(a[si]) == "needs_manual_confirmation"),
    "required_to_upgrade_to_PASS": "Seed ONE ambiguous fixture in the QA DB (two same-day documents with contradictory supersession, served from a local http server and registered as a watched_source), rerun, and assert: that row == needs_manual_confirmation AND published table checksum unchanged.",
})
