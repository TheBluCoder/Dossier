"""One-off: generate missing photo/cctv evidence images for every case still
in the active docket (status=available). Existing media_url values are left
alone.

    python -m scripts.backfill_evidence_images
"""

import asyncio
import sys

sys.path.insert(0, ".")

from app.core.db import get_db  # noqa: E402
from app.models.case import Case  # noqa: E402
from app.services.images import _VISUAL_EVIDENCE_TYPES, add_evidence_images  # noqa: E402


async def main() -> None:
    db = get_db()
    cases = await db.cases.find({"status": "available"}).to_list(length=None)
    print(f"Found {len(cases)} available case(s) to check.")

    for doc in cases:
        case_id = doc["_id"]
        case = Case(**{k: v for k, v in doc.items() if k != "_id"})
        missing = [
            e.title for e in case.evidence if e.type in _VISUAL_EVIDENCE_TYPES and not e.media_url
        ]
        if not missing:
            print(f"  {case.title}: all evidence images already present, skipping.")
            continue

        print(f"  {case.title}: generating for {missing}")
        await add_evidence_images(case)
        await db.cases.update_one(
            {"_id": case_id}, {"$set": {"evidence": [e.model_dump() for e in case.evidence]}}
        )
        done = [e.title for e in case.evidence if e.media_url]
        print(f"  {case.title}: now have images for {done}")


if __name__ == "__main__":
    asyncio.run(main())
