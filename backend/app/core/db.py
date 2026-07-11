from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import get_settings

_client: AsyncIOMotorClient | None = None


def get_db() -> AsyncIOMotorDatabase:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(get_settings().mongodb_uri)
    return _client[get_settings().mongodb_db]


async def close_db() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
