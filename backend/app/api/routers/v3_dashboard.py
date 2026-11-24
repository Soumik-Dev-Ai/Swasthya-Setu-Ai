"""V3 district dashboard router (FR-13). ADMIN-only, rate-limited per doc 03 §7."""
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.core.config import settings
from app.core.limiter import limiter
from app.db import get_db
from app.models.user import User
from app.schemas.care import DistrictDashboardOut
from app.services import dashboard_service

router = APIRouter()


@router.get("/dashboard/district", response_model=DistrictDashboardOut)
@limiter.limit("10/minute")
async def district_dashboard(
    request: Request,
    current: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
    district_id: str | None = None,
):
    """Aggregate district dashboard, cache-served (15 min TTL)."""
    return await dashboard_service.district_aggregates(db, district_id=district_id)