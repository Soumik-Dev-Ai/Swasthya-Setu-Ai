"""Doc 27 item 1 — live, end-to-end verification against a REAL running

server (not the ASGI test transport, not type checking). Spawns uvicorn on a
fresh SQLite DB, seeds the minimum fixtures, drives the six critical flows,
captures per-flow evidence, and writes docs/E2E_VERIFICATION_EVIDENCE.md.

Run:  python -m scripts.e2e_verify
"""
from __future__ import annotations

import asyncio
import os
import socket
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def _tiny_png() -> bytes:
    return bytes.fromhex(
        "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
        "1f15c4890000000d49444154789c63000100000500010d0a2db4000000"
        "0049454e44ae426082"
    )


async def _seed(db_url: str) -> list[int]:
    os.environ["DATABASE_URL"] = db_url
    from app.db.database import Base, engine
    from app.core.security import hash_password
    from app.models.facility import Facility
    from app.models.government_cost import GovernmentCost
    from app.models.patient import PatientRecord
    from app.models.scheme import Scheme
    from app.models.user import Role, User
    from datetime import date as _date

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from app.db.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        db.add(User(username="admin", hashed_password=hash_password("adminpass123"), role=Role.ADMIN))
        f1 = Facility(name="E2E PHC", type="PHC", pm_jay_empaneled=False, lat=26.9, lng=75.8, district="Jaipur", state="RJ")
        f2 = Facility(name="E2E CHC", type="CHC", pm_jay_empaneled=True, lat=26.85, lng=75.9, district="Jaipur", state="RJ")
        db.add_all([f1, f2])
        await db.flush()
        # An overdue maternal patient -> the follow-up scheduler must flag it.
        db.add(
            PatientRecord(
                demographic_hash="e2e-overdue-maternal",
                display_name="Overdue Mother",
                age_band="25-30",
                risk_flags={"maternal": True},
                created_at=datetime.now(timezone.utc) - timedelta(days=40),
            )
        )
        # 7C: hybrid-fallback fixtures — an uncurated-district facility, a
        # verified government cost row for a non-curated procedure, and a
        # SQL-only scheme row.
        db.add(Facility(name="Hooghly Govt Clinic", type="CHC", pm_jay_empaneled=True,
                        lat=22.9, lng=88.39, district="Hooghly", state="WB"))
        db.add(GovernmentCost(
            procedure_key="e2e-dialysis-session", amount_inr=12500,
            source_document="e2e-verified-rates.pdf",
            grounding_quote="Dialysis session rate Rs 12,500",
            effective_date=_date(2026, 2, 10),
            last_verified_date=datetime(2026, 2, 10, tzinfo=timezone.utc),
            needs_manual_confirmation=False, active=True, version=1,
        ))
        db.add(Scheme(
            name="Hooghly Health Assistance Scheme",
            coverage_rules="Rs 3 lakh family cover for BPL households in Hooghly",
            eligibility_notes="BPL card required; apply at the district hospital helpdesk",
            registration_portal_url=None, enrollment_method="facility_based",
        ))
        await db.commit()
        return [f1.id, f2.id]


def main() -> None:
    import tempfile

    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    db_url = f"sqlite+aiosqlite:///{tmp.name}"

    env = dict(os.environ)
    env.update({
        "DATABASE_URL": db_url,
        "JWT_SECRET": "e2e-test-secret",
        "JWT_REFRESH_SECRET": "e2e-test-refresh-secret",
        "EMBEDDING_MODEL": "hash",
        "GEMINI_API_KEY": "", "GROQ_API_KEY": "", "NVIDIA_API_KEY": "",
        "ENABLE_WEB_SCRAPE": "false",
    })

    facility_ids = asyncio.run(_seed(db_url))

    port = _free_port()
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port), "--log-level", "warning"],
        cwd=str(ROOT), env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )

    base = f"http://127.0.0.1:{port}/api"
    evidence: list[tuple[str, str, str]] = []  # (flow, result, detail)

    def record(flow: str, ok: bool, detail: str) -> None:
        evidence.append((flow, "PASS" if ok else "FAIL", detail))

    try:
        up = False
        for _ in range(60):
            try:
                if httpx.get(f"http://127.0.0.1:{port}/health").status_code == 200:
                    up = True
                    break
            except Exception:
                pass
            time.sleep(0.5)
        if not up:
            print("server did not start")
            raise SystemExit(1)

        with httpx.Client(timeout=30.0) as c:
            # F1 — text triage (red flag)
            r = c.post(f"{base}/triage/analyze", json={"symptoms": "chest pain radiating", "flags": []})
            b = r.json()
            record("F1 text triage (red flag)",
                   r.status_code == 200 and b.get("level") == 4 and b.get("emergency") is True
                   and "chest pain" in (b.get("safety_audit") or {}).get("triggered_keywords", []),
                   f"status={r.status_code} level={b.get('level')} emergency={b.get('emergency')} keywords={b.get('safety_audit', {}).get('triggered_keywords')}")

            # F1b — text triage (non-red-flag) with grounded reasoning flag
            r = c.post(f"{base}/triage/analyze", json={"symptoms": "fever and cough for two days", "flags": [], "reasoning": True})
            b = r.json()
            record("F1b text triage + reasoning flag",
                   r.status_code == 200 and "reasoning" in b,
                   f"status={r.status_code} has_reasoning={'reasoning' in b} level={b.get('level')}")

            # F2 — image triage (multipart, real PNG)
            r = c.post(f"{base}/triage/analyze", data={"symptoms": "rash on arm", "flags": "[]"},
                       files={"image": ("rash.png", _tiny_png(), "image/png")})
            b = r.json()
            record("F2 image triage (multipart)",
                   r.status_code == 200 and "level" in b,
                   f"status={r.status_code} level={b.get('level')} vision={b.get('vision_signal', {}).get('visual_urgency_signal')}")

            # F3 — cost estimate with PM-JAY eligibility
            r = c.post(f"{base}/cost/alternatives", json={"cityId": "jaipur", "diseaseId": "delivery", "severity": "moderate"})
            b = r.json()
            record("F3 cost alternatives (PM-JAY)",
                   r.status_code == 200 and isinstance(b, list) and len(b) > 0 and isinstance(b[0].get("total"), int),
                   f"status={r.status_code} hospitals={len(b)} first_total={b[0].get('total') if b else None}")

            # F4 — ASHA register -> pending-login-rejected -> admin activate -> login
            reg = c.post(f"{base}/auth/register-asha", json={
                "username": "e2e_asha", "password": "asha12345", "full_name": "E2E Worker",
                "date_of_birth": "1990-01-01", "phone": "9876543210", "aadhaar_last4": "1234",
                "village_ward": "E2E Village", "district": "Jaipur", "state": "Rajasthan",
                "specialities": ["HBNC"],
            })
            pending_login = c.post(f"{base}/auth/login", json={"username": "e2e_asha", "password": "asha12345"})
            admin_login = c.post(f"{base}/auth/login", json={"username": "admin", "password": "adminpass123"})
            admin_token = admin_login.json().get("access_token")
            pending_list = c.get(f"{base}/admin/users/pending", headers={"Authorization": f"Bearer {admin_token}"})
            uid = pending_list.json()[0]["id"] if pending_list.json() else None
            activate = c.patch(f"{base}/admin/users/{uid}/activate", headers={"Authorization": f"Bearer {admin_token}"}) if uid else None
            asha_login = c.post(f"{base}/auth/login", json={"username": "e2e_asha", "password": "asha12345"})
            record("F4 ASHA register->activate->login",
                   reg.status_code == 201 and pending_login.status_code == 403 and activate is not None and activate.status_code == 200 and activate.json().get("role") == "ASHA" and asha_login.status_code == 200,
                   f"register={reg.status_code} pending_login={pending_login.status_code} activate={activate.status_code if activate else None} role={activate.json().get('role') if activate else None} final_login={asha_login.status_code}")

            # F5 — referral create (idempotent) -> update (pending -> in_transit)
            asha_token = asha_login.json().get("access_token")
            h = {"Authorization": f"Bearer {asha_token}"}
            pat = c.post(f"{base}/v3/patients", json={"demographic_hash": "e2e-hash-1", "display_name": "E2E Patient", "age_band": "30-40", "risk_flags": {}}, headers=h)
            pid = pat.json().get("id")
            from_fac, to_fac = facility_ids
            ref = c.post(f"{base}/v3/referrals", json={"patient_id": pid, "from_facility_id": from_fac, "to_facility_id": to_fac, "urgency_tier": "L2"},
                         headers={**h, "Idempotency-Key": "e2e-ref-1"})
            dup = c.post(f"{base}/v3/referrals", json={"patient_id": pid, "from_facility_id": from_fac, "to_facility_id": to_fac, "urgency_tier": "L2"},
                         headers={**h, "Idempotency-Key": "e2e-ref-1"})
            rid = ref.json().get("id")
            upd = c.patch(f"{base}/v3/referrals/{rid}", json={"status": "in_transit"}, headers=h)
            record("F5 referral create->idempotent->update",
                   ref.status_code == 200 and dup.json().get("id") == rid and upd.status_code == 200 and upd.json().get("status") == "in_transit",
                   f"created={rid} idempotent_same_id={dup.json().get('id') == rid} updated_status={upd.json().get('status') if upd.status_code == 200 else upd.status_code}")

            # F6 — follow-up worklist -> scheduler flags overdue -> mark visited
            run = c.post(f"{base}/v3/followups/run", headers={"Authorization": f"Bearer {admin_token}"})
            wl = c.get(f"{base}/v3/followups", headers=h)
            worklist = wl.json() if wl.status_code == 200 else []
            open_item = next((x for x in worklist if not x.get("resolved")), None)
            mark = None
            if open_item:
                mark = c.patch(f"{base}/v3/followups/{open_item['id']}", json={}, headers=h)
            record("F6 follow-up worklist->mark visited",
                   run.status_code == 200 and run.json().get("created", 0) >= 1 and wl.status_code == 200 and mark is not None and mark.status_code == 200 and mark.json().get("resolved") is True,
                   f"scheduler_created={run.json().get('created')} worklist_len={len(worklist)} marked={mark.status_code if mark else None} resolved={mark.json().get('resolved') if mark and mark.status_code == 200 else None}")

            # F7 — token expiry -> 401 -> refresh rotation -> 200
            from jose import jwt
            past = int((datetime.now(timezone.utc) - timedelta(minutes=5)).timestamp())
            expired = jwt.encode({"sub": uid, "role": "ASHA", "iat": past - 60, "exp": past, "typ": "access"}, "e2e-test-secret", algorithm="HS256")
            me_expired = c.get(f"{base}/auth/me", headers={"Authorization": f"Bearer {expired}"})
            refresh = c.post(f"{base}/auth/refresh", json={"refresh_token": asha_login.json().get("refresh_token")})
            new_access = refresh.json().get("access_token") if refresh.status_code == 200 else None
            me_new = c.get(f"{base}/auth/me", headers={"Authorization": f"Bearer {new_access}"}) if new_access else None
            record("F7 token expiry->refresh rotation",
                   me_expired.status_code == 401 and refresh.status_code == 200 and me_new is not None and me_new.status_code == 200 and me_new.json().get("username") == "e2e_asha",
                   f"expired_me={me_expired.status_code} refresh={refresh.status_code} refreshed_me={me_new.status_code if me_new else None}")

            # F8 (7C) — hybrid fallbacks live: uncurated city -> SQL Facility
            # table; non-curated procedure -> GovernmentCost base + its own
            # as_of; SQL scheme merge honest (general_eligibility, real text).
            fac = c.post(f"{base}/facilities/search", json={"cityId": "hooghly", "filters": {"pmjay": True, "er24": False, "icu": False, "blood": False, "nabh": False, "beds": False}, "query": "", "sort": "near"})
            frows = fac.json() if fac.status_code == 200 else []
            sql_fallback_ok = any(str(r["hospital"]["id"]).startswith("sql-") for r in frows) and any(r["hospital"]["name"] == "Hooghly Govt Clinic" for r in frows)

            cost = c.post(f"{base}/cost/alternatives", json={"cityId": "jaipur", "diseaseId": "e2e-dialysis-session", "severity": "mild"})
            crows = cost.json() if cost.status_code == 200 else []
            gov_ok = bool(crows) and all(r["as_of"] == "2026-02-10" for r in crows) and all(r["total"] > 0 for r in crows)

            sch = c.post(f"{base}/schemes/match", json={"state": "RJ", "income": 0, "category": "cat.gen", "work": "work.daily", "need": "need.general"})
            srows = sch.json() if sch.status_code == 200 else []
            pmjay = next((m for m in srows if m["scheme"]["id"] == "pmjay"), None)
            merged = next((m for m in srows if m["scheme"]["name"] == "Hooghly Health Assistance Scheme"), None)
            schemes_ok = (
                pmjay is not None and pmjay["scheme"]["enrollment_method"] == "csc_based"
                and pmjay["scheme"]["registration_portal_url"] is None  # doc 25 §2: honest null, never a guessed URL
                and merged is not None and merged["scheme"]["match_basis"] == "general_eligibility"
                and "Rs 3 lakh" in merged["scheme"]["benefit"]
            )
            record("F8 hybrid fallbacks (facility SQL / gov cost / scheme merge)",
                   fac.status_code == 200 and sql_fallback_ok and cost.status_code == 200 and gov_ok and schemes_ok,
                   f"facility_sql_fallback={sql_fallback_ok} gov_cost_as_of={'2026-02-10' if gov_ok else 'FAIL'} "
                   f"pmjay_csc_null_url={pmjay['scheme']['registration_portal_url'] is None if pmjay else None} "
                   f"sql_scheme_merged={merged is not None and merged['scheme'].get('match_basis') == 'general_eligibility'}")

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except Exception:
            proc.kill()

    lines = [
        "# End-to-End Verification Evidence (doc 27 item 1)",
        "",
        f"Generated {datetime.now(timezone.utc).isoformat()} against a live `uvicorn` server",
        "(fresh SQLite DB, `EMBEDDING_MODEL=hash`, no provider API keys, `ENABLE_WEB_SCRAPE=false`).",
        "",
        "| Flow | Result | Evidence |",
        "|---|---|---|",
    ]
    for flow, result, detail in evidence:
        lines.append(f"| {flow} | {result} | {detail} |")
    report_path = ROOT.parent / "docs" / "E2E_VERIFICATION_EVIDENCE.md"
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    for flow, result, detail in evidence:
        print(f"{result:4}  {flow}")
        print(f"       {detail}")
    print(f"\nEvidence written to {report_path}")


if __name__ == "__main__":
    main()