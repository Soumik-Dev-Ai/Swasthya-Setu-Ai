"""FastAPI application entrypoint for SwasthyaSetu AI."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.routers import api_router
from app.core.config import settings, validate_production_settings
from app.core.limiter import limiter
from app.db.database import Base, engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("swasthyasetu")

# Interactive API docs are a development convenience; expose them only
# outside production (phase-0 finding N4). The OpenAPI JSON used by CI
# contract checks is gated the same way.
_docs_enabled = settings.ENV != "prod"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle.

    - Rejects insecure production configuration before serving traffic.
    - Auto-creates tables only against the local SQLite scaffold; production
      schemas are managed exclusively through Alembic migrations.
    - Discovers available LLM provider models once at startup (provider
      registry) so the cascade never depends on a hardcoded model name.
    """
    validate_production_settings()
    if settings.DATABASE_URL.startswith("sqlite"):
        logger.info("SQLite detected — auto-creating tables for scaffold.")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    else:
        try:
            from sqlalchemy import text
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        except Exception as exc:
            logger.warning("DB warmup failed: %s", exc)
    from app.services.provider_registry import refresh_providers

    await refresh_providers()

    # doc 24: structurally forbid edge-model loading outside local_dev and
    # warn if any weight files are present in a cloud deployment.
    from app.services import edge_model_guard
    edge_model_guard.startup_check(logger, Path(__file__).resolve().parent.parent.parent)

    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description=(
        "Offline-first healthcare navigation & affordability backend for rural India. "
        "Supports web + offline-first mobile sync."
    ),
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)
app.add_middleware(SlowAPIMiddleware)

app.state.limiter = limiter
app.include_router(api_router)


# ---------------------------------------------------------------------------
# Standardized error envelope (audit finding #17):
# every error response across v1/v2/v3 shares one shape — the frontend never
# has to special-case error handling per API version.
#   {"error": {"code": "...", "message": "...", "details": ...}}
# ---------------------------------------------------------------------------

_ERROR_CODES = {
    status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
    status.HTTP_401_UNAUTHORIZED: "UNAUTHENTICATED",
    status.HTTP_403_FORBIDDEN: "FORBIDDEN",
    status.HTTP_404_NOT_FOUND: "NOT_FOUND",
    status.HTTP_409_CONFLICT: "CONFLICT",
    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE: "PAYLOAD_TOO_LARGE",
    status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
    status.HTTP_422_UNPROCESSABLE_ENTITY: "VALIDATION_FAILED",
    status.HTTP_429_TOO_MANY_REQUESTS: "RATE_LIMITED",
    status.HTTP_500_INTERNAL_SERVER_ERROR: "INTERNAL_ERROR",
}


def _envelope(code_status: int, message: object, details: object = None) -> dict:
    if not isinstance(message, str):
        details = details if details is not None else message
        message = "Request failed"
    return {
        "error": {
            "code": _ERROR_CODES.get(code_status, "INTERNAL_ERROR"),
            "message": message,
            "details": details,
        }
    }


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    # Registered on the Starlette base so framework 404s (unknown routes)
    # use the same envelope as app-raised HTTPExceptions.
    headers = getattr(exc, "headers", None)
    return JSONResponse(
        status_code=exc.status_code,
        content=_envelope(exc.status_code, exc.detail),
        headers=headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_envelope(status.HTTP_422_UNPROCESSABLE_ENTITY, "Request validation failed", jsonable_encoder(exc.errors())),
    )


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content=_envelope(status.HTTP_429_TOO_MANY_REQUESTS, "Rate limit exceeded", str(exc.detail)),
        headers={"Retry-After": "60"},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Never leak internals to the client; the full error stays server-side.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_envelope(status.HTTP_500_INTERNAL_SERVER_ERROR, "Internal server error"),
    )


@app.get("/health", tags=["health"])
@limiter.limit("200/minute")
async def health(request: Request) -> dict:
    return {"status": "ok", "service": settings.APP_NAME}


@app.get("/", tags=["root"])
async def root() -> dict:
    return {"service": settings.APP_NAME, "docs": "/docs" if _docs_enabled else None}
