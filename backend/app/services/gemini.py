"""All Gemini calls: case generation, suspect agents, verdict analysis.

The frontend never talks to Gemini — everything goes through here so private
case data stays server-side.
"""

import json
import logging
import random
import re
from typing import Any, AsyncIterator

from fastapi import HTTPException
from google import genai
from google.genai import types

from app.core.config import get_settings
from app.core.messages import ErrorMessages
from app.models.case import Case, Suspect
from app.models.investigation import SuspectReply, SuspectState
from app.services import prompts

logger = logging.getLogger(__name__)

_client: genai.Client | None = None


def suspect_count_for_difficulty(difficulty: int, minimum: int, maximum: int) -> int:
    """Interpolate a difficulty from 1-10 across the configured suspect range."""
    span = maximum - minimum
    return minimum + int((((difficulty - 1) * span) / 9) + 0.5)


def get_client() -> genai.Client:
    """Return the shared Gemini client or a user-safe configuration error."""
    global _client
    settings = get_settings()
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail=ErrorMessages.GEMINI_NOT_CONFIGURED,
        )
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _parse_json(text: str) -> dict[str, Any]:
    """Gemini occasionally wraps JSON in markdown fences despite instructions."""
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        cleaned = cleaned.removeprefix("json").strip()
    return json.loads(cleaned)


# ── Output safety ────────────────────────────────────────────────────────────
# Telltale fragments of the system prompt / raw model output that must never
# reach the player. Suspects legitimately reveal their SECRETS under pressure —
# this guards against instruction dumps, not against gameplay reveals.
_META_LEAK_MARKERS = (
    "## ",
    "is_culprit",
    "known_facts",
    "unknown_facts",
    "knows_about_others",
    "system prompt",
    "system instruction",
    "trust_change",
    "patience_change",
    "as an ai",
    "language model",
    "i am an ai",
    "roleplaying as",
    "fourth wall",
)


def contains_meta_leak(text: str) -> bool:
    """True when suspect dialogue contains system-prompt or meta-output markers."""
    lowered = text.lower()
    return any(marker in lowered for marker in _META_LEAK_MARKERS)


def deflection_reply() -> SuspectReply:
    """In-character stand-in used whenever the model output cannot be shown."""
    return SuspectReply(
        response="I don't follow, Detective. If you have a real question about the case, ask it.",
        emotion="evasive",
        patience_change=-5,
    )


def _clamp(value: Any, low: int, high: int, default: int = 0) -> int:
    try:
        value = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(low, min(high, value))


def _to_reply(data: dict[str, Any]) -> SuspectReply:
    """Build a SuspectReply, clamping numeric fields instead of rejecting
    slightly-out-of-range model output (which used to trigger the raw-text
    fallback path)."""
    data = dict(data)
    if not isinstance(data.get("response"), str) or not data["response"].strip():
        raise ValueError("suspect reply has no response text")
    data["trust_change"] = _clamp(data.get("trust_change"), -15, 15)
    data["patience_change"] = _clamp(data.get("patience_change"), -25, 10)
    try:
        intensity = float(data.get("emotion_intensity", 0.3))
    except (TypeError, ValueError):
        intensity = 0.3
    data["emotion_intensity"] = max(0.0, min(1.0, intensity))
    return SuspectReply(**data)


def _build_suspect_system(case: Case, suspect: Suspect, state: SuspectState) -> str:
    """Render private case knowledge into the suspect's system instruction."""
    private = suspect.private
    if private.is_culprit:
        role_block = prompts.CULPRIT_ROLE.format(motive=private.motive or "unknown")
    else:
        role_block = prompts.INNOCENT_ROLE

    def bullets(items: list[str]) -> str:
        return "\n".join(f"- {i}" for i in items) or "- (nothing notable)"

    others = "\n".join(
        f"- About {case.suspect(k.suspect_id).name if case.suspect(k.suspect_id) else k.suspect_id}: {k.knowledge}"
        for k in private.knows_about_others
    ) or "- (nothing about the others)"

    return prompts.SUSPECT_SYSTEM.format(
        name=suspect.name,
        crime_type=case.crime_type,
        age=suspect.age,
        occupation=suspect.occupation,
        personality=suspect.personality,
        background=suspect.background,
        relationship=suspect.relationship,
        alibi=suspect.alibi,
        secret=private.secret,
        objective=private.objective,
        known_facts=bullets(private.known_facts),
        unknown_facts=bullets(private.unknown_facts),
        knows_about_others=others,
        role_block=role_block,
        trust=state.trust,
        patience=state.patience,
    )


def _suspect_request(
    case: Case,
    suspect: Suspect,
    state: SuspectState,
    history: list[dict],
    player_message: str,
    presented_evidence: dict | None,
) -> tuple[list[types.Content], types.GenerateContentConfig]:
    """Shared request builder for the streaming and non-streaming suspect calls."""
    settings = get_settings()

    contents: list[types.Content] = []
    for turn in history[-settings.max_history_messages :]:
        contents.append(types.Content(role="user", parts=[types.Part(text=turn["player_message"])]))
        contents.append(types.Content(role="model", parts=[types.Part(text=turn["response"])]))

    if presented_evidence:
        message = prompts.EVIDENCE_PRESENTED.format(
            title=presented_evidence["title"],
            description=presented_evidence["description"],
            message=player_message or "What do you say to this?",
        )
    else:
        message = player_message
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))

    config = types.GenerateContentConfig(
        system_instruction=_build_suspect_system(case, suspect, state),
        response_mime_type="application/json",
        response_schema=SuspectReply,
        temperature=0.8,
        max_output_tokens=1024,
    )
    return contents, config


class _ResponseFieldExtractor:
    """Incrementally decode the `response` string field of a streaming JSON reply.

    `response` is SuspectReply's first field (forwarded as propertyOrdering), so
    the spoken line can be streamed to the player while the rest of the JSON is
    still being generated.
    """

    def __init__(self) -> None:
        self._raw = ""
        self._start: int | None = None
        self._scan = 0
        self._end: int | None = None
        self.emitted = 0

    @classmethod
    def _trim_incomplete_escape(cls, segment: str) -> str:
        """Never decode a segment that ends mid-escape or on a high surrogate.

        Runs until stable: trimming a partial low-surrogate escape can expose a
        complete high surrogate underneath, which must be held back too.
        """
        while True:
            trimmed = cls._trim_once(segment)
            if trimmed == segment:
                return segment
            segment = trimmed

    @staticmethod
    def _trim_once(segment: str) -> str:
        trailing_backslashes = len(segment) - len(segment.rstrip("\\"))
        if trailing_backslashes % 2 == 1:
            return segment[:-1]
        # incomplete \uXXXX, or a complete high surrogate awaiting its pair
        match = re.search(r"\\u(?:[0-9a-fA-F]{0,3}|[dD][89abAB][0-9a-fA-F]{2})$", segment)
        if match:
            before = segment[: match.start()]
            if (len(before) - len(before.rstrip("\\"))) % 2 == 0:
                return before
        return segment

    def feed(self, chunk: str) -> str:
        """Return newly completed characters of the response field, if any."""
        if self._end is not None:
            return ""
        self._raw += chunk
        if self._start is None:
            match = re.search(r'"response"\s*:\s*"', self._raw)
            if match is None:
                return ""
            self._start = self._scan = match.end()
        i = self._scan
        while i < len(self._raw):
            char = self._raw[i]
            if char == "\\":
                i += 2
                continue
            if char == '"':
                self._end = i
                break
            i += 1
        self._scan = i

        if self._end is not None:
            segment = self._raw[self._start : self._end]
        else:
            segment = self._trim_incomplete_escape(self._raw[self._start :])
        try:
            decoded = json.loads(f'"{segment}"', strict=False)
        except ValueError:
            return ""
        fresh = decoded[self.emitted :]
        self.emitted = len(decoded)
        return fresh


async def suspect_reply(
    case: Case,
    suspect: Suspect,
    state: SuspectState,
    history: list[dict],
    player_message: str,
    presented_evidence: dict | None = None,
) -> SuspectReply:
    """history: [{player_message, response}, ...] oldest first."""
    settings = get_settings()
    client = get_client()
    contents, config = _suspect_request(case, suspect, state, history, player_message, presented_evidence)

    reply: SuspectReply | None = None
    for attempt in range(2):
        result = await client.aio.models.generate_content(
            model=settings.gemini_chat_model, contents=contents, config=config
        )
        try:
            reply = _to_reply(_parse_json(result.text))
            break
        except Exception:
            logger.exception(
                "Unparseable suspect reply (attempt %s): %.200s", attempt + 1, result.text
            )
    if reply is None:
        # Never expose raw model output to the player.
        reply = deflection_reply()
    if contains_meta_leak(reply.response):
        logger.warning("Suspect reply leaked meta content; replaced with deflection")
        reply = deflection_reply()
    return reply


async def suspect_reply_stream(
    case: Case,
    suspect: Suspect,
    state: SuspectState,
    history: list[dict],
    player_message: str,
    presented_evidence: dict | None = None,
) -> AsyncIterator[tuple[str, str | SuspectReply]]:
    """Yield ("token", text) deltas of the spoken line as Gemini streams them,
    then a final ("reply", SuspectReply) once the full JSON is validated.

    Falls back to the non-streaming call (which never exposes raw output) if
    the stream fails or produces unusable JSON.
    """
    settings = get_settings()
    client = get_client()
    contents, config = _suspect_request(case, suspect, state, history, player_message, presented_evidence)

    extractor = _ResponseFieldExtractor()
    full = ""
    reply: SuspectReply | None = None
    try:
        stream = await client.aio.models.generate_content_stream(
            model=settings.gemini_chat_model, contents=contents, config=config
        )
        async for chunk in stream:
            piece = chunk.text or ""
            if not piece:
                continue
            full += piece
            delta = extractor.feed(piece)
            if delta:
                yield "token", delta
        reply = _to_reply(_parse_json(full))
        tail = reply.response[extractor.emitted :]
        if tail:
            yield "token", tail
    except HTTPException:
        raise
    except Exception:
        logger.exception("Streaming suspect reply failed; falling back to non-streaming")
        reply = await suspect_reply(case, suspect, state, history, player_message, presented_evidence)
    yield "reply", reply


def _validated_case(data: dict[str, Any], difficulty: int, expected_suspects: int) -> Case:
    """Backend-side validation: the game breaks silently if these fail."""
    settings = get_settings()
    case = Case(**data)
    case.difficulty = difficulty  # server-decided, never model-decided
    culprits = [s for s in case.suspects if s.private.is_culprit]
    if len(culprits) != 1:
        raise HTTPException(status_code=502, detail=ErrorMessages.GENERATED_CASE_CULPRIT_COUNT)
    if case.solution.culprit_id != culprits[0].id:
        case.solution.culprit_id = culprits[0].id
    if len(case.suspects) != expected_suspects:
        raise HTTPException(
            status_code=502,
            detail=ErrorMessages.generated_case_suspect_count(expected_suspects),
        )
    if not settings.case_min_evidence <= len(case.evidence) <= settings.case_max_evidence:
        raise HTTPException(
            status_code=502,
            detail=ErrorMessages.generated_case_evidence_count(
                settings.case_min_evidence, settings.case_max_evidence
            ),
        )
    return case


async def generate_case(
    crime_type: str = "murder",
    difficulty: int | None = None,
    used_titles: list[str] | None = None,
    used_names: list[str] | None = None,
) -> Case:
    """Generate and validate a solvable case using configured content limits.

    Difficulty and the exact suspect count are decided server-side and given to
    the model as constants — asking the model to do the interpolation arithmetic
    wasted expensive generations on validation 502s.
    """
    settings = get_settings()
    client = get_client()
    if difficulty is None:
        difficulty = random.randint(1, 10)
    expected_suspects = suspect_count_for_difficulty(
        difficulty, settings.case_min_suspects, settings.case_max_suspects
    )
    prompt = prompts.CASE_GENERATION.format(
        crime_type=crime_type,
        difficulty=difficulty,
        suspect_count=expected_suspects,
        min_evidence=settings.case_min_evidence,
        max_evidence=settings.case_max_evidence,
        used_titles=", ".join(used_titles or []) or "(none)",
        used_names=", ".join(used_names or []) or "(none)",
    )

    last_error: Exception | None = None
    for attempt in range(2):
        result = await client.aio.models.generate_content(
            model=settings.gemini_case_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.9,
                max_output_tokens=16384,
            ),
        )
        try:
            return _validated_case(_parse_json(result.text), difficulty, expected_suspects)
        except Exception as exc:
            last_error = exc
            logger.warning("Generated case rejected (attempt %s): %s", attempt + 1, exc)
    if isinstance(last_error, HTTPException):
        raise last_error
    raise HTTPException(status_code=502, detail=ErrorMessages.GENERATED_CASE_INVALID)


_NON_ANSWERS = {
    "", "i don't know", "i dont know", "idk", "not sure", "no idea", "unsure",
    "n/a", "na", "dunno", "no clue", "unknown", "not applicable", "none", "?",
}


def _is_non_answer(text: str) -> bool:
    return text.strip().lower().rstrip(".!? ") in _NON_ANSWERS


async def analyze_verdict(
    case: Case, accused_id: str, correct: bool, player_motive: str, player_explanation: str
) -> str:
    """Assess the player's verdict, falling back safely if Gemini is unavailable.

    A blank/non-answer motive+reasoning is handled deterministically rather
    than sent to the model — an ungrounded LLM asked to critique reasoning
    that was never given will still confidently invent specific claims about
    what the player "correctly identified" or "overlooked."
    """
    settings = get_settings()
    accused = case.suspect(accused_id)
    culprit = case.suspect(case.solution.culprit_id)
    name = accused.name if accused else accused_id

    if _is_non_answer(player_motive) and _is_non_answer(player_explanation):
        if correct:
            return (
                f"You named {name} correctly, Detective, but offered no motive or reasoning — "
                "the commission credits the accusation, not the guesswork behind it. Review the "
                "case file below to see how the evidence actually tied together."
            )
        return (
            f"You named {name} without offering a motive or reasoning, Detective. The commission "
            "can't assess an analysis that was never made — review the case file below to see "
            "what the evidence actually showed."
        )

    try:
        client = get_client()
        result = await client.aio.models.generate_content(
            model=settings.gemini_chat_model,
            contents=prompts.VERDICT_ANALYSIS.format(
                accused_name=accused.name if accused else accused_id,
                verdict_result="CORRECT" if correct else "INCORRECT",
                culprit_name=culprit.name if culprit else "unknown",
                explanation=case.solution.explanation,
                player_motive=player_motive,
                player_explanation=player_explanation,
            ),
            config=types.GenerateContentConfig(temperature=0.6, max_output_tokens=512),
        )
        return result.text.strip()
    except Exception:
        logger.exception("Verdict analysis failed; falling back to canned text")
        return (
            "Sharp work, Detective — the evidence lined up with your reasoning."
            if correct
            else "The pieces didn't quite fit, Detective. Review the solution and the clues you missed."
        )
