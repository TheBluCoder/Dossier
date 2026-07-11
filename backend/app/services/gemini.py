"""All Gemini calls: case generation, suspect agents, verdict analysis.

The frontend never talks to Gemini — everything goes through here so private
case data stays server-side.
"""

import json
import logging

from fastapi import HTTPException
from google import genai
from google.genai import types

from app.core.config import get_settings
from app.models.case import Case, Suspect
from app.models.investigation import SuspectReply, SuspectState
from app.services import prompts

logger = logging.getLogger(__name__)

_client: genai.Client | None = None


def get_client() -> genai.Client:
    global _client
    settings = get_settings()
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not configured — set it in .env and restart.",
        )
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _parse_json(text: str) -> dict:
    """Gemini occasionally wraps JSON in markdown fences despite instructions."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        cleaned = cleaned.removeprefix("json").strip()
    return json.loads(cleaned)


def _build_suspect_system(case: Case, suspect: Suspect, state: SuspectState) -> str:
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

    result = await client.aio.models.generate_content(
        model=settings.gemini_chat_model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=_build_suspect_system(case, suspect, state),
            response_mime_type="application/json",
            temperature=0.8,
            max_output_tokens=1024,
        ),
    )

    try:
        reply = SuspectReply(**_parse_json(result.text))
    except Exception:
        logger.exception("Unparseable suspect reply: %s", result.text)
        reply = SuspectReply(response=result.text.strip()[:400] or "...", emotion="neutral")
    return reply


async def generate_case(crime_type: str = "murder") -> Case:
    settings = get_settings()
    client = get_client()
    result = await client.aio.models.generate_content(
        model=settings.gemini_case_model,
        contents=prompts.CASE_GENERATION.format(crime_type=crime_type),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.9,
            max_output_tokens=16384,
        ),
    )
    data = _parse_json(result.text)
    case = Case(**data)

    # Backend-side validation: the game breaks silently if these fail.
    culprits = [s for s in case.suspects if s.private.is_culprit]
    if len(culprits) != 1:
        raise HTTPException(status_code=502, detail="Generated case does not have exactly one culprit")
    if case.solution.culprit_id != culprits[0].id:
        case.solution.culprit_id = culprits[0].id
    if len(case.suspects) < 3:
        raise HTTPException(status_code=502, detail="Generated case has fewer than 3 suspects")
    if len(case.evidence) < 3:
        raise HTTPException(status_code=502, detail="Generated case has too little evidence")
    return case


async def analyze_verdict(
    case: Case, accused_id: str, correct: bool, player_motive: str, player_explanation: str
) -> str:
    settings = get_settings()
    accused = case.suspect(accused_id)
    culprit = case.suspect(case.solution.culprit_id)
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
