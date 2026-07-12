from collections import OrderedDict

from fastapi import APIRouter, Depends, HTTPException, Response, WebSocket, WebSocketDisconnect
from elevenlabs import AsyncElevenLabs
from pydantic import BaseModel

from app.api.deps import load_case, load_investigation, oid
from app.core.auth import AuthUser, get_current_user
from app.core.config import get_settings
from app.core.db import get_db
from app.core.messages import ErrorMessages
from app.core.ratelimit import check_rate_limit
from app.models.investigation import Delivery, SuspectReply
from app.services import speech_engine, voice

router = APIRouter(prefix="/api/audio", tags=["audio"])

TTS_PER_MINUTE = 30

# TTS is billed per character — replaying a line must not re-synthesize it.
_audio_cache: OrderedDict[str, bytes] = OrderedDict()
_AUDIO_CACHE_MAX = 128


class SynthesizeRequest(BaseModel):
    message_id: str


@router.post("/synthesize")
async def synthesize(body: SynthesizeRequest, user: AuthUser = Depends(get_current_user)):
    """Speak one stored suspect line.

    The client sends a message id, never text — the audio comes from the
    persisted interrogation message, so this cannot be used as a free-form
    TTS proxy, and the suspect's stored emotion/delivery drive the acting.
    """
    doc = await get_db().interrogations.find_one(
        {"_id": oid(body.message_id), "user_id": user.id}
    )
    if not doc:
        raise HTTPException(status_code=404, detail=ErrorMessages.MESSAGE_UNAVAILABLE)

    cached = _audio_cache.get(body.message_id)
    if cached is not None:
        _audio_cache.move_to_end(body.message_id)
        return Response(content=cached, media_type="audio/mpeg")

    check_rate_limit(f"tts:{user.id}", TTS_PER_MINUTE)
    inv = await load_investigation(doc["investigation_id"], user)
    _, case = await load_case(inv["case_id"])
    suspect = case.suspect(doc["suspect_id"])
    if not suspect:
        raise HTTPException(status_code=404, detail=ErrorMessages.SUSPECT_NOT_FOUND)

    reply = SuspectReply(
        response=doc["response"],
        emotion=doc.get("emotion", "neutral"),
        delivery=Delivery(**(doc.get("delivery") or {})),
    )
    audio = await voice.synthesize(
        voice.expressive_text(reply), voice.voice_for_suspect(suspect)
    )
    _audio_cache[body.message_id] = audio
    if len(_audio_cache) > _AUDIO_CACHE_MAX:
        _audio_cache.popitem(last=False)
    return Response(content=audio, media_type="audio/mpeg")


@router.post("/speech-engine/token/{investigation_id}/{suspect_id}")
async def speech_engine_token(
    investigation_id: str, suspect_id: str, user: AuthUser = Depends(get_current_user)
):
    """Create an isolated live-voice session for an interrogation."""
    return await speech_engine.provision(investigation_id, suspect_id, user)


@router.websocket("/speech-engine/ws")
async def speech_engine_ws(websocket: WebSocket, key: str):
    """Bridge ElevenLabs transcripts to the game's suspect agent."""
    context = speech_engine.contexts.pop(key, None)
    if not context:
        await websocket.close(code=1008)
        return
    settings = get_settings()
    client = AsyncElevenLabs(api_key=settings.elevenlabs_api_key)
    engine = await client.speech_engine.get(context.engine_id)
    if not engine.verify_request(dict(websocket.headers)):
        await websocket.close(code=1008)
        return
    await websocket.accept()
    session = engine.create_session(websocket)

    async def on_transcript(transcript):
        users = [m.content for m in transcript if m.role == "user"]
        if not users:
            return
        reply = await speech_engine.run_turn(context, users[-1])
        if reply:
            await session.send_response(voice.expressive_text(reply))

    session.on("user_transcript", on_transcript)
    try:
        await session.run()
    except WebSocketDisconnect:
        pass
    finally:
        await speech_engine.delete_engine(context)
