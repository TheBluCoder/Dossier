"""Per-interrogation ElevenLabs Speech Engine sessions."""

import logging
import secrets
from dataclasses import dataclass

import httpx
from fastapi import HTTPException

from app.api.deps import load_case, load_investigation, oid, recent_history
from app.core.auth import AuthUser
from app.core.config import get_settings
from app.core.db import get_db
from app.core.messages import ErrorMessages
from app.models.investigation import InterrogationMessage, SuspectState
from app.services import gemini, voice

logger = logging.getLogger(__name__)


@dataclass
class VoiceContext:
    investigation_id: str
    suspect_id: str
    user: AuthUser
    engine_id: str


contexts: dict[str, VoiceContext] = {}


async def provision(investigation_id: str, suspect_id: str, user: AuthUser) -> dict:
    """Provision an isolated Speech Engine and return a browser-safe token."""
    settings = get_settings()
    api_base_url = settings.elevenlabs_api_base_url.rstrip("/")
    public_url = settings.public_api_url or settings.public_backend_url
    if not settings.elevenlabs_api_key or not public_url:
        raise HTTPException(
            status_code=503,
            detail=ErrorMessages.VOICE_DIALOG_NOT_CONFIGURED,
        )
    inv = await load_investigation(investigation_id, user)
    _, case = await load_case(inv["case_id"])
    suspect = case.suspect(suspect_id)
    if not suspect:
        raise HTTPException(status_code=404, detail=ErrorMessages.SUSPECT_NOT_FOUND)

    key = secrets.token_urlsafe(32)
    ws_origin = public_url.rstrip("/").replace("https://", "wss://").replace("http://", "ws://")
    payload = {
        "name": f"Detective K - {suspect.name}",
        "speech_engine": {"ws_url": f"{ws_origin}/api/audio/speech-engine/ws?key={key}"},
        "tts": {
            "model_id": settings.elevenlabs_tts_model,
            "voice_id": voice.voice_for_suspect(suspect),
            "agent_output_audio_format": settings.elevenlabs_output_audio_format,
            "stability": settings.elevenlabs_stability,
            "similarity_boost": settings.elevenlabs_similarity_boost,
        },
        "turn": {
            "mode": "turn",
            "turn_eagerness": settings.elevenlabs_turn_eagerness,
            "turn_timeout": settings.elevenlabs_turn_timeout_seconds,
        },
        "conversation": {
            "max_duration_seconds": settings.elevenlabs_session_max_seconds,
            "client_events": ["audio", "interruption", "agent_response", "user_transcript"],
        },
        "privacy": {"record_voice": False, "delete_audio": True, "retention_days": 0},
    }
    headers = {"xi-api-key": settings.elevenlabs_api_key}
    async with httpx.AsyncClient(timeout=30) as client:
        created = await client.post(f"{api_base_url}/speech-engine", headers=headers, json=payload)
        if created.status_code not in (200, 201):
            logger.error(
                "ElevenLabs Speech Engine creation failed status=%s response=%s",
                created.status_code, created.text[:1000],
            )
            raise HTTPException(
                status_code=502,
                detail=ErrorMessages.VOICE_UNAVAILABLE,
            )
        engine_id = created.json()["speech_engine_id"]
        token_res = await client.get(
            f"{api_base_url}/convai/conversation/token",
            headers=headers,
            params={"agent_id": engine_id, "participant_name": user.id},
        )
        if token_res.status_code != 200:
            logger.error(
                "ElevenLabs conversation token failed status=%s response=%s",
                token_res.status_code, token_res.text[:1000],
            )
            await client.delete(f"{api_base_url}/speech-engine/{engine_id}", headers=headers)
            raise HTTPException(
                status_code=502,
                detail=ErrorMessages.VOICE_UNAVAILABLE,
            )
    contexts[key] = VoiceContext(investigation_id, suspect_id, user, engine_id)
    return {"token": token_res.json()["token"]}


async def delete_engine(context: VoiceContext) -> None:
    """Delete the temporary provider resource after its WebSocket closes."""
    settings = get_settings()
    api_base_url = settings.elevenlabs_api_base_url.rstrip("/")
    async with httpx.AsyncClient(timeout=15) as client:
        await client.delete(
            f"{api_base_url}/speech-engine/{context.engine_id}",
            headers={"xi-api-key": settings.elevenlabs_api_key},
        )


async def run_turn(context: VoiceContext, player_message: str):
    """Generate, persist, and apply game-state effects for one voice turn."""
    inv = await load_investigation(context.investigation_id, context.user)
    _, case = await load_case(inv["case_id"])
    suspect = case.suspect(context.suspect_id)
    state = SuspectState(**inv["suspect_state"].get(context.suspect_id, {}))
    if not suspect or state.conversation_ended:
        return None
    history = await recent_history(
        context.investigation_id, context.suspect_id, get_settings().max_history_messages
    )
    reply = await gemini.suspect_reply(case, suspect, state, history, player_message)
    trust = max(0, min(100, state.trust + reply.trust_change))
    patience = max(0, min(100, state.patience + reply.patience_change))
    # Patience hitting 0 is a precondition, never a trigger on its own — the
    # suspect still has to actually choose to end it (see prompts.SUSPECT_SYSTEM).
    ended = patience == 0 and reply.conversation_ended
    record = InterrogationMessage(
        investigation_id=context.investigation_id, user_id=context.user.id,
        suspect_id=context.suspect_id, player_message=player_message, input_type="voice",
        response=reply.response, emotion=reply.emotion, emotion_intensity=reply.emotion_intensity,
        delivery=reply.delivery, trust_before=state.trust, trust_after=trust,
        patience_before=state.patience, patience_after=patience, conversation_ended=ended,
    )
    await get_db().interrogations.insert_one(record.model_dump())
    await get_db().investigations.update_one(
        {"_id": oid(context.investigation_id)},
        {"$set": {f"suspect_state.{context.suspect_id}": SuspectState(
            trust=trust, patience=patience, conversation_ended=ended
        ).model_dump()}},
    )
    return reply
