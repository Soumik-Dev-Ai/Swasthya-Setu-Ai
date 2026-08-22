"""Database package."""
from app.db.database import AsyncSessionLocal, Base, engine


async def get_db() -> AsyncSessionLocal:  # type: ignore[valid-type]
    """FastAPI dependency that yields an async session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
