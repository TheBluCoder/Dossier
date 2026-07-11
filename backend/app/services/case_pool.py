"""Background case-pool maintenance.

The commission always has CASE_POOL_SIZE open cases. Generation happens in the
background — kicked on startup and whenever a case is solved — so players never
wait on Gemini. Generated cases are validated and persisted like any other.
"""

import asyncio
import logging
import random

from app.core.config import get_settings
from app.core.db import get_db
from app.services import gemini

logger = logging.getLogger(__name__)

CRIME_TYPES = ["murder", "theft", "arson", "fraud", "kidnapping"]
MAX_CONSECUTIVE_FAILURES = 3

_lock = asyncio.Lock()
_generating = False


def is_generating() -> bool:
    return _generating


async def available_count() -> int:
    return await get_db().cases.count_documents({"status": "available"})


async def ensure_case_pool() -> None:
    """Generate cases until the pool holds CASE_POOL_SIZE available ones."""
    global _generating
    settings = get_settings()
    if not settings.gemini_api_key:
        logger.warning("Case pool below target but GEMINI_API_KEY is not set — skipping generation")
        return

    if _lock.locked():
        return  # a top-up is already running
    async with _lock:
        _generating = True
        failures = 0
        try:
            while failures < MAX_CONSECUTIVE_FAILURES:
                count = await available_count()
                if count >= settings.case_pool_size:
                    break
                crime_type = random.choice(CRIME_TYPES)
                logger.info("Case pool at %s/%s — generating a %s case", count, settings.case_pool_size, crime_type)
                try:
                    case = await gemini.generate_case(crime_type)
                except Exception:
                    failures += 1
                    logger.exception("Case generation failed (%s/%s)", failures, MAX_CONSECUTIVE_FAILURES)
                    await asyncio.sleep(2**failures)
                    continue
                failures = 0
                await get_db().cases.insert_one(case.model_dump())
                logger.info("Added case to pool: %s", case.title)
        finally:
            _generating = False


def kick_case_pool() -> None:
    """Fire-and-forget pool top-up from request handlers / startup."""

    async def _run() -> None:
        try:
            await ensure_case_pool()
        except Exception:
            logger.exception("Case pool maintenance crashed")

    asyncio.create_task(_run())
