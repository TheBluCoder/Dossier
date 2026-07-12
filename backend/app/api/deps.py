import time
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException

from app.core.auth import AuthUser
from app.core.db import get_db
from app.core.messages import ErrorMessages
from app.models.case import Case


def oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail=ErrorMessages.NOT_FOUND)


async def load_investigation(investigation_id: str, user: AuthUser) -> dict:
    doc = await get_db().investigations.find_one({"_id": oid(investigation_id)})
    if not doc or doc["user_id"] != user.id:
        raise HTTPException(status_code=404, detail=ErrorMessages.INVESTIGATION_NOT_FOUND)
    return doc


# Cases are immutable after generation apart from status/failure_count, yet
# every interrogation turn used to re-fetch and re-validate the full document.
# Small TTL cache; call invalidate_case() wherever a case document is mutated.
_CASE_CACHE_TTL_SECONDS = 60.0
_CASE_CACHE_MAX_ENTRIES = 64
_case_cache: dict[str, tuple[float, Case]] = {}


def invalidate_case(case_id: str) -> None:
    _case_cache.pop(case_id, None)


async def load_case(case_id: str) -> tuple[str, Case]:
    cached = _case_cache.get(case_id)
    if cached and time.monotonic() - cached[0] < _CASE_CACHE_TTL_SECONDS:
        return case_id, cached[1]
    doc = await get_db().cases.find_one({"_id": oid(case_id)})
    if not doc:
        raise HTTPException(status_code=404, detail=ErrorMessages.CASE_NOT_FOUND)
    doc_id = str(doc.pop("_id"))
    case = Case(**doc)
    if len(_case_cache) >= _CASE_CACHE_MAX_ENTRIES:
        _case_cache.pop(next(iter(_case_cache)))
    _case_cache[doc_id] = (time.monotonic(), case)
    return doc_id, case


async def recent_history(investigation_id: str, suspect_id: str, limit: int) -> list[dict[str, Any]]:
    """Last `limit` Q/A exchanges for one suspect, oldest first.

    Bounded at the database so long interrogations don't slow down every turn —
    only what fits the Gemini context window is ever loaded.
    """
    docs = await (
        get_db()
        .interrogations.find(
            {"investigation_id": investigation_id, "suspect_id": suspect_id},
            {"player_message": 1, "response": 1},
        )
        .sort("created_at", -1)
        .limit(limit)
        .to_list(length=limit)
    )
    return [
        {"player_message": d["player_message"], "response": d["response"]}
        for d in reversed(docs)
    ]
