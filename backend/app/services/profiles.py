"""User profile persistence: upsert on auth, stats updates on verdicts."""

from app.core.auth import AuthUser
from app.core.db import get_db
from app.models.user import UserProfile, reputation_delta, tier_for, utcnow


def public_profile(doc: dict) -> dict:
    profile = UserProfile(**{k: v for k, v in doc.items() if k != "_id"})
    total = profile.cases_solved + profile.cases_failed
    return {
        **profile.model_dump(),
        "tier": tier_for(profile.reputation),
        "cases_total": total,
        "win_rate": round(profile.cases_solved / total * 100) if total else 0,
    }


async def upsert_user(user: AuthUser) -> dict:
    db = get_db()
    doc = await db.users.find_one_and_update(
        {"user_id": user.id},
        {
            "$set": {"avatar_url": user.avatar_url, "last_active": utcnow()},
            # `name` seeds from the auth provider only on the FIRST login —
            # once a player customizes it, later logins must not clobber it.
            "$setOnInsert": UserProfile(user_id=user.id, name=user.name).model_dump(
                exclude={"user_id", "avatar_url", "last_active"}
            ),
        },
        upsert=True,
        return_document=True,
    )
    return doc


async def set_username(user_id: str, name: str) -> dict:
    """Update the player's public display name (see UserProfile.name)."""
    db = get_db()
    doc = await db.users.find_one_and_update(
        {"user_id": user_id},
        {"$set": {"name": name, "last_active": utcnow()}},
        upsert=True,
        return_document=True,
    )
    return doc


async def apply_verdict_result(user_id: str, correct: bool, difficulty: int) -> int:
    """Update reputation and case stats; returns the applied RS delta."""
    db = get_db()
    delta = reputation_delta(correct, difficulty)
    field = "cases_solved" if correct else "cases_failed"
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"reputation": delta, field: 1}, "$set": {"last_active": utcnow()}},
        upsert=True,
    )
    # Reputation never goes below 0 (GDD v2 floor).
    await db.users.update_one(
        {"user_id": user_id, "reputation": {"$lt": 0}}, {"$set": {"reputation": 0}}
    )
    return delta
