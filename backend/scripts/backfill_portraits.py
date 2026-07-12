"""One-off: fill in missing suspect portraits for every case still in the
active docket (status=available). Existing image_url values are left alone.

    python -m scripts.backfill_portraits
"""

import asyncio
import sys

sys.path.insert(0, ".")

from app.core.db import get_db  # noqa: E402
from app.models.case import Case  # noqa: E402
from app.services.images import add_suspect_portraits  # noqa: E402


async def main() -> None:
    db = get_db()
    cases = await db.cases.find({"status": "available"}).to_list(length=None)
    print(f"Found {len(cases)} available case(s) to check.")

    for doc in cases:
        case_id = doc["_id"]
        case = Case(**{k: v for k, v in doc.items() if k != "_id"})
        missing = [s.name for s in case.suspects if not s.image_url]
        if not missing:
            print(f"  {case.title}: all portraits already present, skipping.")
            continue

        print(f"  {case.title}: generating for {missing}")
        await add_suspect_portraits(case)
        await db.cases.update_one(
            {"_id": case_id}, {"$set": {"suspects": [s.model_dump() for s in case.suspects]}}
        )
        done = [s.name for s in case.suspects if s.image_url]
        print(f"  {case.title}: now have portraits for {done}")


if __name__ == "__main__":
    asyncio.run(main())
