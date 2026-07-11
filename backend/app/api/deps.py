from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException

from app.core.auth import AuthUser
from app.core.db import get_db
from app.models.case import Case


def oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Not found")


async def load_investigation(investigation_id: str, user: AuthUser) -> dict:
    doc = await get_db().investigations.find_one({"_id": oid(investigation_id)})
    if not doc or doc["user_id"] != user.id:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return doc


async def load_case(case_id: str) -> tuple[str, Case]:
    doc = await get_db().cases.find_one({"_id": oid(case_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Case not found")
    doc_id = str(doc.pop("_id"))
    return doc_id, Case(**doc)
