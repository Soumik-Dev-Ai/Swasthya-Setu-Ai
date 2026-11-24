"""Application configuration using Pydantic BaseSettings.

Switching between SQLite (scaffold) and PostgreSQL only requires changing
the DATABASE_URL environment variable; everything else is inherited.
"""
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "SwasthyaSetu AI"
    ENV: Literal["dev", "prod", "test"] = "dev"
    DEBUG: bool = False

    # doc 24 — where this process runs. The fine-tuned edge (ONNX) model may
    # only ever load in "local_dev" (developer machine testing) or on-device
    # (the mobile bundle — not this backend at all). The cloud-deployed
    # backend must NEVER load it; the online Reasoning Engine cascade is its
    # only triage-refinement path. Default is the SAFE side: no model loads.
    DEPLOYMENT_TARGET: Literal["local_dev", "cloud_production"] = "cloud_production"

    # Switch to Postgres in production by setting DATABASE_URL in .env, e.g.:
    # DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/swasthyasetu
    DATABASE_URL: str = "sqlite+aiosqlite:///./swasthyasetu.db"

    # JWT settings
    JWT_SECRET: str = "dev-insecure-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    # Refresh tokens (audit finding #9): separate secret + longer lifetime.
    # Falls back to JWT_SECRET when unset — acceptable for dev only.
    JWT_REFRESH_SECRET: str = ""
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Default admin bootstrap (used by seed script)
    DEFAULT_ADMIN_USERNAME: str = "admin"
    DEFAULT_ADMIN_PASSWORD: str = "admin123"

    DEFAULT_ASHA_USERNAME: str = "asha1"
    DEFAULT_ASHA_PASSWORD: str = "asha123"

    # Mocked AI microservice URL (for future wiring)
    AI_SERVICE_URL: str = "http://localhost:9000"

    # CORS — explicit allow-list (audit finding #7 / docs 03 §12).
    # No wildcard origin in any environment; add the deployed frontend
    # origin explicitly via env (e.g. CORS_ORIGINS=["https://...vercel.app"]).
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]
    CORS_ALLOW_METHODS: list[str] = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]
    CORS_ALLOW_HEADERS: list[str] = ["Authorization", "Content-Type", "Idempotency-Key"]

    # ===== V3 Deep Integration: Maps / Cost Engine / Vision Triage =====
    # All keys are OPTIONAL — features degrade gracefully when unset.
    # NEVER hardcode keys; always set via environment / .env file.

    # Google Maps API key (places search, reviews)
    GOOGLE_MAPS_API_KEY: str = ""

    # Vision LLM cascade keys (Gemini → Groq → NVIDIA fallback)
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    NVIDIA_API_KEY: str = ""

    # Provider-specific model overrides (optional). When empty, the system
    # auto-discovers the best available model from each provider at startup.
    # Set these ONLY if you want to pin a specific model (e.g., for reproducibility).
    GEMINI_MODEL_OVERRIDE: str = ""
    NVIDIA_MODEL_OVERRIDE: str = ""
    GROQ_MODEL_OVERRIDE: str = ""

    # When False (default), the /facilities/advanced-search endpoint
    # will return curated-data matches only and skip the scrape+LLM
    # cascade entirely. Set True in .env to enable the experimental
    # community-estimate path. Default-off is the safe default per
    # AI Ethics Rule 4 (no fabricated pricing).
    ENABLE_WEB_SCRAPE: bool = False

    # Cost-engine tuning
    CACHE_TTL_SECONDS: int = 60 * 60 * 24  # 24 hours
    ADVANCED_SEARCH_RATE_LIMIT: str = "10/minute"  # per IP
    # Heavier cap for endpoints that can trigger outbound network (OSINT)
    # or LLM spend on the public, unauthenticated surface (phase-0 N5/N8).
    PUBLIC_HEAVY_RATE_LIMIT: str = "30/minute"  # per IP

    # Vision safety tuning
    VISION_MAX_IMAGE_BYTES: int = 8 * 1024 * 1024  # 8 MB
    VISION_ALLOWED_MIME: tuple[str, ...] = ("image/jpeg", "image/png", "image/webp")

    # --- Phase 3: Knowledge Engine / Financial ETL -------------------------
    # Corpus roots (relative to the repo root, i.e. ../docs_raw from backend/).
    RAG_CORPUS_DIR: str = "../docs_raw"
    FINANCIAL_CORPUS_DIR: str = "../docs_raw/financial"
    # Embedding model: "hash" = deterministic offline default (CI/dev);
    # default now points at the multilingual semantic model for staging/prod
    # (item 1 of the Phase-3 completion plan). Tests pin "hash" via env.
    EMBEDDING_MODEL: str = "intfloat/multilingual-e5-small"
    EMBEDDING_DIM: int = 384  # multilingual-e5-small output dimension
    # Retrieval: hybrid dense+lexical scoring; below this, abstain.
    # hash profile: blended-score floor, measured 2026-09-06 (clinical
    # queries ~0.10-0.17, gibberish <0.08).
    RAG_TOP_K: int = 4
    RAG_MIN_SCORE: float = 0.09
    # semantic (non-hash) profile: cross-script queries have no lexical
    # overlap, so a dense-cosine floor gates them (measured 2026-09-07 on
    # the IMCI corpus: Hindi 0.865 / Bengali 0.826 relevant vs. ~0.82
    # gibberish — 0.84 admits genuine semantic matches, rejects noise).
    RAG_MIN_DENSE: float = 0.85
    # Grounding verification: minimum token overlap between the model's
    # stated reason and the cited chunk before the citation is accepted.
    GROUNDING_MIN_OVERLAP: float = 0.15


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


def validate_production_settings() -> None:
    """Fail fast on insecure defaults when running outside dev/test.

    Prevents a production deployment from silently shipping with the
    scaffold's placeholder JWT secret or seeded default credentials.
    Raises RuntimeError describing every violation found.
    """
    if settings.ENV != "prod":
        return
    problems: list[str] = []
    if settings.JWT_SECRET == "dev-insecure-secret-change-me":
        problems.append("JWT_SECRET is still the insecure development default")
    if not settings.JWT_REFRESH_SECRET:
        problems.append("JWT_REFRESH_SECRET is unset (refresh tokens would share the access-secret)")
    if settings.DEFAULT_ADMIN_PASSWORD == "admin123":
        problems.append("DEFAULT_ADMIN_PASSWORD is still the scaffold default")
    if settings.DATABASE_URL.startswith("sqlite"):
        problems.append("DATABASE_URL points at SQLite; prod requires PostgreSQL (Neon)")
    if problems:
        raise RuntimeError(
            "Refusing to start with insecure production configuration: " + "; ".join(problems)
        )
