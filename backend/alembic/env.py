"""Alembic environment for SwasthyaSetu AI (async SQLAlchemy engine)."""
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import settings
from app.db.database import Base

# Import all models so they are registered on Base.metadata before autogenerate runs.
from app.models import (  # noqa: F401
    AshaRecord,
    AshaWorkerProfile,
    DocumentRegistry,
    Facility,
    FacilityCapacitySnapshot,
    FollowUpWorklist,
    GovernmentCost,
    KnowledgeChunk,
    PatientEvent,
    PatientRecord,
    Pricing,
    Referral,
    SafetyOverrideLog,
    Scheme,
    TriageSession,
    User,
    WatchedSource,
)

config = context.config

# URL precedence: explicit `-x db_url=...` argument (used by tests and
# one-off ops) beats the app settings default.
_x_args = context.get_x_argument(as_dictionary=True)
if "db_url" in _x_args:
    config.set_main_option("sqlalchemy.url", _x_args["db_url"])
else:
    config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
