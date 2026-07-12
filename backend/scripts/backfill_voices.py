"""One-off: design missing suspect voices for every case still in the active
docket (status=available). Existing voice_id values are left alone.

    python -m scripts.backfill_voices
"""

import asyncio
import sys

sys.path.insert(0, ".")

from app.core.db import get_db  # noqa: E402
from app.models.case import Case  # noqa: E402
from app.services.voice_design import add_suspect_voices  # noqa: E402


async def main() -> None:
    db = get_db()
    cases = await db.cases.find({"status": "available"}).to_list(length=None)
    print(f"Found {len(cases)} available case(s) to check.")

    for doc in cases:
        case_id = doc["_id"]
        case = Case(**{k: v for k, v in doc.items() if k != "_id"})
        missing = [s.name for s in case.suspects if not s.voice_id]
        if not missing:
            print(f"  {case.title}: all voices already present, skipping.")
            continue

        print(f"  {case.title}: designing voices for {missing}")
        await add_suspect_voices(case)
        await db.cases.update_one(
            {"_id": case_id}, {"$set": {"suspects": [s.model_dump() for s in case.suspects]}}
        )
        done = [s.name for s in case.suspects if s.voice_id]
        print(f"  {case.title}: now have voices for {done}")


if __name__ == "__main__":
    asyncio.run(main())
