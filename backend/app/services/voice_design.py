"""ElevenLabs Voice Design: generate a bespoke voice per suspect instead of
reusing a small fixed pool of stock voice IDs.

Reusing 8 stock voices across every generated case is why suspects end up
sounding alike and vaguely synthetic no matter how the dialogue is written —
this designs a voice from each suspect's own `voice_description` (age,
gender, accent/timbre), so their age and background actually shape how they
sound. Two-step ElevenLabs flow:

  1. POST /text-to-voice/design  -> preview(s) with a generated_voice_id
  2. POST /text-to-voice          -> saves a preview as a permanent voice_id

Best-effort, mirroring services/images.py: silently skipped when ElevenLabs
isn't configured, and one suspect's failure never blocks the others or the
case — voice_for_suspect() already falls back to the stock voice pools
whenever suspect.voice_id is empty.
"""

import logging

import httpx

from app.core.config import get_settings
from app.models.case import Case, Suspect

logger = logging.getLogger(__name__)


def _voice_description(suspect: Suspect) -> str:
    """Fall back to a description built from public fields for cases
    generated before voice_description existed."""
    return suspect.voice_description or (
        f"A {suspect.age}-year-old {suspect.occupation} named {suspect.name}. "
        f"{suspect.personality}"
    )


async def _design_voice_id(client: httpx.AsyncClient, headers: dict, description: str, name: str) -> str | None:
    settings = get_settings()
    try:
        design_resp = await client.post(
            "/text-to-voice/design",
            headers=headers,
            json={
                "voice_description": description,
                "model_id": settings.elevenlabs_voice_design_model,
                "auto_generate_text": True,
            },
        )
        design_resp.raise_for_status()
        previews = design_resp.json().get("previews") or []
        if not previews:
            return None

        create_resp = await client.post(
            "/text-to-voice",
            headers=headers,
            json={
                "voice_name": name,
                "voice_description": description,
                "generated_voice_id": previews[0]["generated_voice_id"],
            },
        )
        create_resp.raise_for_status()
        return create_resp.json().get("voice_id")
    except httpx.HTTPError:
        logger.warning("ElevenLabs voice design failed for %r", name, exc_info=True)
        return None


async def add_suspect_voices(case: Case) -> None:
    """Best-effort: design and attach a bespoke voice for each suspect that
    doesn't already have one, mutating `case.suspects` in place.

    Runs sequentially — this happens in the background case-pool loop where
    latency doesn't matter, and it keeps a slow account well clear of
    ElevenLabs' rate limits (matches the sequential portrait generation in
    services/images.py for the same reason).
    """
    settings = get_settings()
    if not settings.elevenlabs_api_key:
        return

    headers = {"xi-api-key": settings.elevenlabs_api_key}
    async with httpx.AsyncClient(
        timeout=45, base_url=settings.elevenlabs_api_base_url.rstrip("/")
    ) as client:
        for suspect in case.suspects:
            if suspect.voice_id:
                continue
            voice_name = f"{case.title} — {suspect.name}"[:100]
            voice_id = await _design_voice_id(
                client, headers, _voice_description(suspect), voice_name
            )
            if voice_id:
                suspect.voice_id = voice_id
            else:
                logger.warning(
                    "Voice design skipped for suspect %s (%s)", suspect.id, suspect.name
                )
