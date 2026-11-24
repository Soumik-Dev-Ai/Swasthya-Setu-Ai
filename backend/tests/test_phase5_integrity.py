import pytest
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import AsyncSessionLocal
from app.schemas.asha import AshaRecordCreate
from app.services.sync_service import upsert_asha_record
from app.services.dashboard_service import district_aggregates
from app.services import triage_service, v2_data

@pytest.mark.asyncio
async def test_5a_dashboard_district_scoping():
    """5A: district_aggregates scopes queries when district_id is provided."""
    async with AsyncSessionLocal() as session:
        res_all = await district_aggregates(session, district_id=None)
        assert "triage_volume_by_tier" in res_all
        assert "referral_completion_rate" in res_all
        
        res_jaipur = await district_aggregates(session, district_id="Jaipur")
        assert "triage_volume_by_tier" in res_jaipur
        assert res_jaipur["district_id"] == "Jaipur"

@pytest.mark.asyncio
async def test_5b_last_write_wins():
    """5B: Stale updates (older created_at) must never overwrite existing AshaRecord."""
    async with AsyncSessionLocal() as session:
        t1 = datetime(2026, 10, 20, 12, 0, 0, tzinfo=timezone.utc)
        t0 = datetime(2026, 10, 20, 10, 0, 0, tzinfo=timezone.utc)  # older
        t2 = datetime(2026, 10, 20, 14, 0, 0, tzinfo=timezone.utc)  # newer
        
        local_id = f"test-lww-{datetime.now().timestamp()}"
        worker_id = 999
        
        # 1. Initial insert at T1
        rec1 = AshaRecordCreate(
            record_type="household_survey",
            structured_fields={"status": "initial"},
            device_local_id=local_id,
            created_at=t1,
        )
        saved1, created1 = await upsert_asha_record(session, worker_id, rec1)
        assert created1 is True
        assert saved1.structured_fields["status"] == "initial"
        
        # 2. Retransmitted stale update at T0 (older) -> ignored
        rec_stale = AshaRecordCreate(
            record_type="household_survey",
            structured_fields={"status": "stale_overwrite"},
            device_local_id=local_id,
            created_at=t0,
        )
        saved_stale, created_stale = await upsert_asha_record(session, worker_id, rec_stale)
        assert created_stale is False
        assert saved_stale.structured_fields["status"] == "initial"
        
        # 3. Newer update at T2 (newer) -> applied
        rec_newer = AshaRecordCreate(
            record_type="household_survey",
            structured_fields={"status": "updated_fresh"},
            device_local_id=local_id,
            created_at=t2,
        )
        saved_newer, created_newer = await upsert_asha_record(session, worker_id, rec_newer)
        assert created_newer is False
        assert saved_newer.structured_fields["status"] == "updated_fresh"

def test_5c_dead_code_eliminated():
    """5C: Stale ASHA_WORKERS fixture and duplicate RED_FLAG_KEYWORDS are deleted."""
    assert not hasattr(v2_data, "ASHA_WORKERS"), "v2_data.ASHA_WORKERS should be deleted"
    assert not hasattr(triage_service, "RED_FLAG_KEYWORDS"), "triage_service.RED_FLAG_KEYWORDS should be deleted"

def test_5d_cascade_centralized():
    """5D: Intent classifier and pricing service import get_cascade."""
    import inspect
    from app.services import intent_classifier, pricing_service
    src_intent = inspect.getsource(intent_classifier)
    src_pricing = inspect.getsource(pricing_service)
    assert "get_cascade" in src_intent
    assert "get_cascade" in src_pricing

def test_5e_grounding_bypass_closed():
    """5E: Vision and reasoning services verify chunks retrieved vs cited."""
    import inspect
    from app.services import vision_service, reasoning_engine
    src_vision = inspect.getsource(vision_service)
    src_reasoning = inspect.getsource(reasoning_engine)
    assert "retrieved_ids" in src_vision and "ungrounded" in src_vision
    assert "retrieved_ids" in src_reasoning and "ungrounded" in src_reasoning

def test_5f_quarantine_directory_exists():
    """5F: docs_raw/_quarantine/out_of_scope exists and has quarantined specialist files."""
    # Resolve from the repo root (parent of backend/) — pytest's CWD varies.
    repo_root = Path(__file__).resolve().parents[2]
    q_dir = repo_root / "docs_raw" / "_quarantine" / "out_of_scope"
    assert q_dir.exists() and q_dir.is_dir()
    files = list(q_dir.glob("*.pdf"))
    assert len(files) >= 10, f"Expected quarantined PDFs, found {len(files)}"
