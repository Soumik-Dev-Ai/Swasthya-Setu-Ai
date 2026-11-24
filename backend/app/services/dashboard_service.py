"""District/facility dashboard aggregation (FR-13, doc 03 §16).

Aggregates are computed from the already-collected tables: anonymized
`triage_sessions` (volume by tier), `referrals` (completion rate + facility
load), and `follow_up_worklist` (backlog). Read path is cache-served with a
15-minute TTL so the free-tier backend isn't scanning raw tables on every
refresh (doc 03 §16's explicit contract).
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.facility import Facility
from app.models.followup import FollowUpWorklist
from app.models.referral import Referral
from app.models.triage import TriageSession
from app.services.cache import TTLCache

_dashboard_cache = TTLCache(max_size=64)
_CACHE_TTL_SECONDS = 15 * 60
_OPEN_REFERRAL_STATES = ("pending", "in_transit", "arrived")


async def district_aggregates(
    db: AsyncSession, *, district_id: str | None = None
) -> dict:
    """Compute the four aggregates, scoped to `district_id` when given.

    Scoping (phase-5 item 5A), with the schema's honest limits:
    - Referrals join their destination `Facility` and match its district.
    - Triage sessions filter on `region` — the only location-ish field the
      anonymized triage log carries (no district_id column exists).
    - Follow-up backlog stays GLOBAL: the worklist has no district, and
      patients carry none — a wrongly-scoped backlog would be fabricated.
    """
    key = _dashboard_cache.make_key("dashboard", district_id or "")
    cached = await _dashboard_cache.get(key)
    if cached is not None:
        return cached

    tier_stmt = (
        select(TriageSession.urgency_tier, func.count())
        .group_by(TriageSession.urgency_tier)
    )
    referral_base = select(func.count()).select_from(Referral)
    if district_id:
        tier_stmt = tier_stmt.where(TriageSession.region == district_id)
        # Scope referrals through the destination facility's district.
        referral_base = (
            referral_base
            .join(Facility, Referral.to_facility_id == Facility.id)
            .where(Facility.district.ilike(district_id))
        )

    tier_rows = (await db.execute(tier_stmt)).all()
    triage_volume = {str(tier): int(count) for tier, count in tier_rows}

    total_refs = await db.scalar(referral_base)
    completed_stmt = referral_base.where(Referral.status == "completed")
    completed = await db.scalar(completed_stmt)
    completion_rate = round(completed / total_refs, 4) if total_refs else 0.0

    backlog = await db.scalar(
        select(func.count())
        .select_from(FollowUpWorklist)
        .where(FollowUpWorklist.resolved.is_(False))
    )

    open_stmt = (
        select(Referral.to_facility_id, func.count())
        .where(Referral.status.in_(_OPEN_REFERRAL_STATES))
        .group_by(Referral.to_facility_id)
    )
    if district_id:
        open_stmt = (
            open_stmt
            .join(Facility, Referral.to_facility_id == Facility.id)
            .where(Facility.district.ilike(district_id))
        )
    open_refs = (await db.execute(open_stmt)).all()
    facility_load = {str(fid or "unknown"): int(c) for fid, c in open_refs}

    result = {
        "district_id": district_id,
        "triage_volume_by_tier": triage_volume,
        "referral_completion_rate": completion_rate,
        "follow_up_backlog": int(backlog or 0),
        "facility_load": facility_load,
        "generated_at": datetime.now(timezone.utc),
    }
    await _dashboard_cache.set(key, result, ttl_seconds=_CACHE_TTL_SECONDS)
    return result


__all__ = ["district_aggregates"]