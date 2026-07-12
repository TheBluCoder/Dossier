import re

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import AuthUser, get_current_user
from app.core.db import get_db
from app.core.messages import ErrorMessages
from app.services.profiles import public_profile, set_username, upsert_user

router = APIRouter(prefix="/api", tags=["users"])

LEADERBOARD_SIZE = 20
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9 _'.\-]{2,24}$")


class UsernameUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=24)


@router.get("/me")
async def me(user: AuthUser = Depends(get_current_user)):
    doc = await upsert_user(user)
    return public_profile(doc)


@router.put("/profile/username")
async def update_username(body: UsernameUpdate, user: AuthUser = Depends(get_current_user)):
    """Let a player set a public display name distinct from their real
    auth-provider name — many don't want that shown on the leaderboard."""
    name = body.name.strip()
    if not USERNAME_PATTERN.fullmatch(name):
        raise HTTPException(status_code=422, detail=ErrorMessages.INVALID_USERNAME)
    doc = await set_username(user.id, name)
    return public_profile(doc)


@router.get("/profile")
async def profile(user: AuthUser = Depends(get_current_user)):
    doc = await upsert_user(user)
    data = public_profile(doc)

    # Recent closed cases for the profile's case history.
    history = []
    cursor = (
        get_db()
        .investigations.find({"user_id": user.id, "status": {"$in": ["solved", "failed"]}})
        .sort("completed_at", -1)
        .limit(10)
    )
    async for inv in cursor:
        case = await get_db().cases.find_one({"_id": ObjectId(inv["case_id"])})
        history.append(
            {
                "case_title": case["title"] if case else "Unknown case",
                "status": inv["status"],
                "completed_at": inv["completed_at"].isoformat() if inv.get("completed_at") else None,
            }
        )
    return {**data, "history": history}


@router.get("/leaderboard")
async def leaderboard(user: AuthUser = Depends(get_current_user)):
    await upsert_user(user)
    entries = []
    rank = 0
    my_entry = None
    async for doc in (
        get_db().users.find().sort([("reputation", -1), ("cases_solved", -1)]).limit(LEADERBOARD_SIZE)
    ):
        rank += 1
        entry = {"rank": rank, **public_profile(doc)}
        if doc["user_id"] == user.id:
            my_entry = entry
        entries.append(entry)

    if my_entry is None:
        me_doc = await get_db().users.find_one({"user_id": user.id})
        higher = await get_db().users.count_documents(
            {"reputation": {"$gt": me_doc.get("reputation", 0)}}
        )
        my_entry = {"rank": higher + 1, **public_profile(me_doc)}

    return {"entries": entries, "me": my_entry}
