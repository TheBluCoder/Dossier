"""Seeds the handcrafted demo case so the game is playable with zero API keys."""

import json
import logging
from pathlib import Path

from app.core.db import get_db
from app.models.case import Case

logger = logging.getLogger(__name__)

DEMO_CASE_PATH = Path(__file__).resolve().parent.parent / "data" / "demo_case.json"


async def seed_demo_case(force: bool = False) -> bool:
    db = get_db()
    if not force and await db.cases.count_documents({}) > 0:
        return False
    data = json.loads(DEMO_CASE_PATH.read_text(encoding="utf-8"))
    case = Case(**data)  # validate before inserting
    await db.cases.insert_one(case.model_dump())
    logger.info("Seeded demo case: %s", case.title)
    return True
