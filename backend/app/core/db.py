from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import get_settings

_client: AsyncIOMotorClient | None = None


def get_db() -> AsyncIOMotorDatabase:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(get_settings().mongodb_uri)
    return _client[get_settings().mongodb_db]


async def ensure_indexes() -> None:
    """Create the indexes every hot query path relies on (idempotent)."""
    db = get_db()
    await db.interrogations.create_index(
        [("investigation_id", 1), ("suspect_id", 1), ("created_at", 1)]
    )
    await db.investigations.create_index([("user_id", 1), ("case_id", 1), ("status", 1)])
    await db.cases.create_index([("status", 1)])
    await db.users.create_index([("reputation", -1)])


async def close_db() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
