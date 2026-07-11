from datetime import datetime, timezone

from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SuspectState(BaseModel):
    trust: int = 50
    patience: int = 100
    conversation_ended: bool = False


class Verdict(BaseModel):
    accused_id: str
    motive: str
    explanation: str
    evidence_ids: list[str] = []


class Investigation(BaseModel):
    user_id: str
    case_id: str
    status: str = "in_progress"  # in_progress | solved | failed
    notes: str = ""
    reviewed_evidence: list[str] = []
    suspect_state: dict[str, SuspectState] = {}
    verdict: dict | None = None
    created_at: datetime = Field(default_factory=utcnow)
    completed_at: datetime | None = None


class Delivery(BaseModel):
    pace: str = "steady"
    hesitation: bool = False
    confidence: float = 0.5


class SuspectReply(BaseModel):
    """Structured output the suspect agent must return."""

    response: str
    emotion: str = "neutral"
    emotion_intensity: float = Field(default=0.3, ge=0, le=1)
    delivery: Delivery = Delivery()
    trust_change: int = Field(default=0, ge=-15, le=15)
    patience_change: int = Field(default=0, ge=-25, le=10)
    conversation_ended: bool = False


class InterrogationMessage(BaseModel):
    investigation_id: str
    user_id: str
    suspect_id: str
    player_message: str
    input_type: str = "text"  # text | voice
    evidence_id: str | None = None
    response: str
    emotion: str
    emotion_intensity: float
    delivery: Delivery
    trust_before: int
    trust_after: int
    patience_before: int
    patience_after: int
    conversation_ended: bool = False
    audio_url: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
