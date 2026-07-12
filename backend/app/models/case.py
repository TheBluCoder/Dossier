"""Case domain models.

A case document holds BOTH public briefing data and private solution data.
Anything the player must not see before the resolution screen lives under
`Suspect.private`, `Case.canonical_timeline`, or `Case.solution` — the
sanitizers in services/sanitize.py are the only path to the frontend.
"""

from pydantic import BaseModel, Field


class Victim(BaseModel):
    name: str
    age: int
    occupation: str
    background: str


class CrimeScene(BaseModel):
    location: str
    time: str
    description: str


class TimelineEntry(BaseModel):
    time: str
    event: str


class SuspectKnowledge(BaseModel):
    suspect_id: str
    knowledge: str


class SuspectPrivate(BaseModel):
    is_culprit: bool = False
    secret: str
    objective: str
    motive: str | None = None  # culprit only
    known_facts: list[str] = []
    unknown_facts: list[str] = []
    knows_about_others: list[SuspectKnowledge] = []


class Suspect(BaseModel):
    id: str
    name: str
    age: int
    occupation: str
    relationship: str  # to the victim
    background: str
    alibi: str
    personality: str
    voice_id: str | None = None  # ElevenLabs voice
    voice_description: str | None = None  # casting note used to design voice_id
    image_url: str | None = None  # generated portrait; null falls back to initials
    private: SuspectPrivate


class Evidence(BaseModel):
    id: str
    title: str
    type: str  # report | witness_statement | email | phone_record | receipt | security_log | photo | audio | cctv
    description: str
    timestamp: str | None = None
    related_suspects: list[str] = []
    media_url: str | None = None
    canonical_facts: list[str] = []  # for generated media evidence


class Solution(BaseModel):
    culprit_id: str
    motive: str
    explanation: str
    suspect_secrets: dict[str, str] = {}  # suspect_id -> why they seemed suspicious
    key_clues: list[str] = []


class Case(BaseModel):
    title: str
    crime_type: str
    difficulty: int = Field(ge=1, le=10)
    summary: str
    status: str = "available"  # available | in_progress | solved | archived
    failure_count: int = 0  # wrong verdicts across all players; archived at 5
    victim: Victim
    crime_scene: CrimeScene
    public_timeline: list[TimelineEntry] = []
    canonical_timeline: list[TimelineEntry] = []  # PRIVATE
    suspects: list[Suspect]
    evidence: list[Evidence]
    solution: Solution  # PRIVATE

    def suspect(self, suspect_id: str) -> Suspect | None:
        return next((s for s in self.suspects if s.id == suspect_id), None)

    def evidence_item(self, evidence_id: str) -> Evidence | None:
        return next((e for e in self.evidence if e.id == evidence_id), None)
