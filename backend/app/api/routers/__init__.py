"""API routers package.

V2 note: `triage` router was removed from the aggregate because the v2_engine
router owns `POST /api/triage/analyze` (different response shape — theLevel/
emergency/matched contract the React frontend expects). The mobile/offline
endpoints (auth, asha, sync, admin, routing) remain unchanged.
"""
from fastapi import APIRouter

from app.api.routers import (
    admin,
    asha,
    asha_discovery,
    auth,
    routing,
    sync,
    v2_engine,
    v3_care,
    v3_dashboard,
    v3_intent,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(routing.router, prefix="/routing", tags=["routing"])
api_router.include_router(asha.router, prefix="/asha", tags=["asha"])
api_router.include_router(sync.router, prefix="/sync", tags=["sync"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
# V2 engine: /api/triage/*, /api/cost/*, /api/insurance/*, /api/schemes/*,
# /api/facilities/*, /api/asha/emergency-sync
api_router.include_router(v2_engine.router, tags=["v2"])
# Public ASHA worker discovery: /api/v2/asha-workers/nearby
api_router.include_router(asha_discovery.router, prefix="/v2/asha-workers", tags=["asha-discovery"])
# V3: /api/v3/patients, /api/v3/referrals, /api/v3/followups,
#     /api/v3/facilities/capacity, /api/v3/intent, /api/v3/dashboard
api_router.include_router(v3_care.router, prefix="/v3", tags=["v3-care"])
api_router.include_router(v3_dashboard.router, prefix="/v3", tags=["v3-dashboard"])
api_router.include_router(v3_intent.router, prefix="/v3", tags=["v3-intent"])
