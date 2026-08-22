"""API routers package.

V2 note: `triage` router was removed from the aggregate because the v2_engine
router owns `POST /api/triage/analyze` (different response shape — theLevel/
emergency/matched contract the React frontend expects). The mobile/offline
endpoints (auth, asha, sync, admin, routing) remain unchanged.
"""
from fastapi import APIRouter

from app.api.routers import admin, asha, auth, routing, sync, v2_engine

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(routing.router, prefix="/routing", tags=["routing"])
api_router.include_router(asha.router, prefix="/asha", tags=["asha"])
api_router.include_router(sync.router, prefix="/sync", tags=["sync"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
# V2 engine: /api/triage/*, /api/cost/*, /api/insurance/*, /api/schemes/*,
# /api/facilities/*, /api/asha/emergency-sync
api_router.include_router(v2_engine.router, tags=["v2"])
