"""Player profiles and the stripped-down reputation/tier system.

Adapted from the full Detective K design (GAME_DESIGN_DOCUMENT-v2): same tier
names and RS thresholds, simplified gains — no credits, XP, decay, or retries.
"""

from datetime import datetime, timezone

from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# (threshold, tier name) — ascending. Matches detective-k-game utils/constants.ts.
TIERS: list[tuple[int, str]] = [
    (0, "Rookie"),
    (300, "Inspector"),
    (800, "Senior"),
    (1500, "Master"),
    (2000, "Legend"),
]


def tier_for(reputation: int) -> dict:
    current = TIERS[0]
    next_tier: tuple[int, str] | None = None
    for threshold, name in TIERS:
        if reputation >= threshold:
            current = (threshold, name)
        elif next_tier is None:
            next_tier = (threshold, name)
    return {
        "name": current[1],
        "min_rs": current[0],
        "next_tier": next_tier[1] if next_tier else None,
        "next_tier_rs": next_tier[0] if next_tier else None,
    }


def reputation_delta(correct: bool, difficulty: int) -> int:
    """Detective K rules, simplified: +75 base with a difficulty bonus, -50 flat."""
    d = max(1, min(10, difficulty))
    return 75 + d * 5 if correct else -50


class UserProfile(BaseModel):
    user_id: str
    name: str = "Detective"
    avatar_url: str | None = None
    reputation: int = 0
    cases_solved: int = 0
    cases_failed: int = 0
    created_at: datetime = Field(default_factory=utcnow)
    last_active: datetime = Field(default_factory=utcnow)
