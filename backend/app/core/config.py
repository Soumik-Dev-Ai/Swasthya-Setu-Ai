"""Application configuration using Pydantic BaseSettings.

Switching between SQLite (scaffold) and PostgreSQL only requires changing
the DATABASE_URL environment variable; everything else is inherited.
"""
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "SwasthyaSetu AI"
    ENV: Literal["dev", "prod", "test"] = "dev"
    DEBUG: bool = False

    # Switch to Postgres in production by setting DATABASE_URL in .env, e.g.:
    # DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/swasthyasetu
    DATABASE_URL: str = "sqlite+aiosqlite:///./swasthyasetu.db"

    # JWT settings
    JWT_SECRET: str = "dev-insecure-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # Default admin bootstrap (used by seed script)
    DEFAULT_ADMIN_USERNAME: str = "admin"
    DEFAULT_ADMIN_PASSWORD: str = "admin123"

    DEFAULT_ASHA_USERNAME: str = "asha1"
    DEFAULT_ASHA_PASSWORD: str = "asha123"

    # Mocked AI microservice URL (for future wiring)
    AI_SERVICE_URL: str = "http://localhost:9000"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # ===== V3 Deep Integration: Maps / Cost Engine / Vision Triage =====
    # All keys are OPTIONAL — features degrade gracefully when unset.
    # NEVER hardcode keys; always set via environment / .env file.

    # Google Maps API key (places search, reviews)
    GOOGLE_MAPS_API_KEY: str = ""

    # Vision LLM cascade keys (Gemini → Groq → NVIDIA fallback)
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    NVIDIA_API_KEY: str = ""

    # When False (default), the /facilities/advanced-search endpoint
    # will return curated-data matches only and skip the scrape+LLM
    # cascade entirely. Set True in .env to enable the experimental
    # community-estimate path. Default-off is the safe default per
    # AI Ethics Rule 4 (no fabricated pricing).
    ENABLE_WEB_SCRAPE: bool = False

    # Cost-engine tuning
    CACHE_TTL_SECONDS: int = 60 * 60 * 24  # 24 hours
    ADVANCED_SEARCH_RATE_LIMIT: str = "10/minute"  # per IP

    # Vision safety tuning
    VISION_MAX_IMAGE_BYTES: int = 8 * 1024 * 1024  # 8 MB
    VISION_ALLOWED_MIME: tuple[str, ...] = ("image/jpeg", "image/png", "image/webp")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
