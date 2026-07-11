"""ElevenLabs text-to-speech for suspect voices (REST, no SDK dependency)."""

import httpx
from fastapi import HTTPException

from app.core.config import get_settings

ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # Rachel — fallback when a suspect has no voice


async def synthesize(text: str, voice_id: str | None = None) -> bytes:
    settings = get_settings()
    if not settings.elevenlabs_api_key:
        raise HTTPException(
            status_code=503,
            detail="ELEVENLABS_API_KEY is not configured — voice playback disabled.",
        )
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            ELEVENLABS_TTS_URL.format(voice_id=voice_id or DEFAULT_VOICE_ID),
            headers={"xi-api-key": settings.elevenlabs_api_key},
            json={
                "text": text,
                "model_id": "eleven_turbo_v2_5",
                "voice_settings": {"stability": 0.45, "similarity_boost": 0.75},
            },
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"ElevenLabs error: {resp.text[:200]}")
    return resp.content
