"""ElevenLabs text-to-speech for suspect voices (REST, no SDK dependency)."""

import hashlib
import logging
import re

import httpx
from fastapi import HTTPException

from app.core.config import get_settings
from app.core.messages import ErrorMessages

logger = logging.getLogger(__name__)


def voice_for_suspect(suspect) -> str:
    """Choose a stable voice when generated case data omits voice_id."""
    if suspect.voice_id:
        return suspect.voice_id
    description = " ".join(
        (suspect.name, suspect.background, suspect.alibi, suspect.personality)
    ).lower()
    masculine = bool(re.search(r"\b(he|him|his|man|male)\b", description))
    feminine = bool(re.search(r"\b(she|her|hers|woman|female)\b", description))
    settings = get_settings()
    configured = (
        settings.elevenlabs_masculine_voice_ids
        if masculine and not feminine
        else settings.elevenlabs_feminine_voice_ids
    )
    pool = tuple(voice_id.strip() for voice_id in configured.split(",") if voice_id.strip())
    if not pool:
        return settings.elevenlabs_default_voice_id
    stable_key = f"{suspect.id}:{suspect.name}".encode()
    index = int.from_bytes(hashlib.sha256(stable_key).digest()[:4], "big") % len(pool)
    return pool[index]


def conversational_times(text: str) -> str:
    """Make embedded 24-hour values sound natural when spoken aloud."""
    def replace(match: re.Match) -> str:
        hour = int(match.group(1))
        minute = match.group(2)
        period = "PM" if hour >= 12 else "AM"
        display_hour = hour % 12 or 12
        return f"{display_hour} {period}" if minute == "00" else f"{display_hour}:{minute} {period}"

    return re.sub(r"\b([01]?\d|2[0-3]):([0-5]\d)\b", replace, text)

EMOTION_TAGS = {
    "nervous": "[nervously]",
    "defensive": "[frustrated]",
    "angry": "[angry]",
    "sad": "[sad]",
    "evasive": "[hesitates]",
    "confident": "[confidently]",
    "frightened": "[scared]",
}


def expressive_text(reply) -> str:
    """Prefix structured acting direction as provider audio tags."""
    spoken_text = conversational_times(reply.response)
    tags: list[str] = []
    if tag := EMOTION_TAGS.get(reply.emotion):
        tags.append(tag)
    if reply.delivery.hesitation and "[hesitates]" not in tags:
        tags.append("[hesitates]")
    if reply.delivery.pace == "slow":
        tags.append("[slowly]")
    elif reply.delivery.pace == "fast":
        tags.append("[quickly]")
    # Tags are instructions for Eleven v3 only. The persisted reply remains
    # plain dialogue, and the client removes this prefix from displayed events.
    return f"{' '.join(tags)} {spoken_text}".strip()


async def synthesize(text: str, voice_id: str | None = None) -> bytes:
    """Synthesize one suspect line without exposing provider errors to clients."""
    settings = get_settings()
    if not settings.elevenlabs_api_key:
        raise HTTPException(
            status_code=503,
            detail=ErrorMessages.VOICE_NOT_CONFIGURED,
        )
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            (
                f"{settings.elevenlabs_api_base_url.rstrip('/')}/text-to-speech/"
                f"{voice_id or settings.elevenlabs_default_voice_id}"
            ),
            headers={"xi-api-key": settings.elevenlabs_api_key},
            json={
                "text": text,
                "model_id": settings.elevenlabs_tts_model,
                "voice_settings": {
                    "stability": settings.elevenlabs_stability,
                    "similarity_boost": settings.elevenlabs_similarity_boost,
                },
            },
        )
    if resp.status_code != 200:
        logger.error(
            "ElevenLabs TTS failed status=%s response=%s",
            resp.status_code,
            resp.text[:1000],
        )
        raise HTTPException(status_code=502, detail=ErrorMessages.VOICE_PLAYBACK_UNAVAILABLE)
    return resp.content
