"""FastAPI application entrypoint for SwasthyaSetu AI."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.routers import api_router
from app.core.config import settings
from app.core.limiter import limiter
from app.db.database import Base, engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("swasthyasetu")

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description=(
        "Offline-first healthcare navigation & affordability backend for rural India. "
        "Supports web + offline-first mobile sync."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.include_router(api_router)


@app.on_event("startup")
async def _startup() -> None:
    """Auto-create tables when running against SQLite scaffold.

    In production, run Alembic migrations instead (`alembic upgrade head`).
    """
    if settings.DATABASE_URL.startswith("sqlite"):
        logger.info("SQLite detected — auto-creating tables for scaffold.")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)


@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok", "service": settings.APP_NAME}


@app.get("/", tags=["root"])
async def root() -> dict:
    return {"service": settings.APP_NAME, "docs": "/docs"}
