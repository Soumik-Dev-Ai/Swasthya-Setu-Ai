# End-to-End Verification Evidence (doc 27 item 1)

Generated 2026-11-23T11:20:17.945079+00:00 against a live `uvicorn` server
(fresh SQLite DB, `EMBEDDING_MODEL=hash`, no provider API keys, `ENABLE_WEB_SCRAPE=false`).

| Flow | Result | Evidence |
|---|---|---|
| F1 text triage (red flag) | PASS | status=200 level=4 emergency=True keywords=['chest pain', '\\b(crushing\\s+chest\\s+pain|chest\\s+pain)\\b'] |
| F1b text triage + reasoning flag | PASS | status=200 has_reasoning=True level=3 |
| F2 image triage (multipart) | PASS | status=200 level=3 vision=uncertain |
| F3 cost alternatives (PM-JAY) | PASS | status=200 hospitals=2 first_total=7392 |
| F4 ASHA register->activate->login | PASS | register=201 pending_login=403 activate=200 role=ASHA final_login=200 |
| F5 referral create->idempotent->update | PASS | created=8c85c258-1726-4671-8ffa-617af23cde18 idempotent_same_id=True updated_status=in_transit |
| F6 follow-up worklist->mark visited | PASS | scheduler_created=1 worklist_len=1 marked=200 resolved=True |
| F7 token expiry->refresh rotation | PASS | expired_me=401 refresh=200 refreshed_me=200 |
| F8 hybrid fallbacks (facility SQL / gov cost / scheme merge) | PASS | facility_sql_fallback=True gov_cost_as_of=2026-02-10 pmjay_csc_null_url=True sql_scheme_merged=True |
