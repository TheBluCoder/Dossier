"""Image generation via Replicate, re-hosted through the provider-agnostic
ImageStorage abstraction (services/storage/) so a Replicate output URL —
which is not guaranteed to stay alive — never ends up persisted directly.
"""

import asyncio
import logging

import replicate
import replicate.exceptions
from fastapi import HTTPException

from app.core.config import get_settings
from app.core.messages import ErrorMessages
from app.models.case import Case, Evidence, Suspect
from app.services.storage import get_storage

logger = logging.getLogger(__name__)

_client: replicate.Client | None = None


def get_client() -> replicate.Client:
    """Return the shared Replicate client or a user-safe configuration error."""
    global _client
    settings = get_settings()
    if not settings.replicate_api_token:
        raise HTTPException(status_code=503, detail=ErrorMessages.IMAGE_GENERATION_NOT_CONFIGURED)
    if _client is None:
        _client = replicate.Client(api_token=settings.replicate_api_token)
    return _client


_MAX_RETRIES = 3


async def generate_image_bytes(prompt: str, *, aspect_ratio: str = "1:1") -> bytes:
    """Run the configured Replicate model and return the raw image bytes.

    Retries on any ReplicateException — that covers both the 429 throttle
    accounts under $5 credit hit (burst of 1/min, worth a longer backoff) and
    transient model/infra errors (e.g. "unexpected error handling prediction"),
    which are common enough on flux-schnell to otherwise cost a suspect their
    portrait for no reason related to our code or credentials.
    """
    settings = get_settings()
    client = get_client()

    def _run() -> bytes:
        output = client.run(
            settings.replicate_image_model,
            input={
                "prompt": prompt,
                "go_fast": True,
                "megapixels": "1",
                "num_outputs": 1,
                "aspect_ratio": aspect_ratio,
                "output_format": "webp",
                "output_quality": 80,
                "num_inference_steps": 4,
            },
        )
        return output[0].read()

    for attempt in range(_MAX_RETRIES):
        try:
            return await asyncio.to_thread(_run)
        except replicate.exceptions.ReplicateException as exc:
            if attempt >= _MAX_RETRIES - 1:
                logger.exception("Replicate image generation failed")
                raise HTTPException(status_code=502, detail=ErrorMessages.IMAGE_GENERATION_FAILED)
            is_throttled = isinstance(exc, replicate.exceptions.ReplicateError) and exc.status == 429
            delay = 10 if is_throttled else 3
            logger.warning(
                "Replicate %s (attempt %s), retrying in %ss: %s",
                "throttled" if is_throttled else "transient error",
                attempt + 1, delay, exc,
            )
            await asyncio.sleep(delay)
        except Exception:
            logger.exception("Replicate image generation failed")
            raise HTTPException(status_code=502, detail=ErrorMessages.IMAGE_GENERATION_FAILED)
    raise HTTPException(status_code=502, detail=ErrorMessages.IMAGE_GENERATION_FAILED)


async def generate_and_store_image(
    prompt: str, *, folder: str, public_id: str | None = None, aspect_ratio: str = "1:1"
) -> str:
    """Generate an image and persist it through the configured storage
    backend. Returns a durable public URL — never a raw Replicate URL."""
    data = await generate_image_bytes(prompt, aspect_ratio=aspect_ratio)
    storage = get_storage()
    return await storage.upload(data, folder=folder, public_id=public_id)


def _portrait_prompt(suspect: Suspect) -> str:
    # Built only from PUBLIC suspect fields — this prompt must never draw on
    # suspect.private (secret, is_culprit, motive). See sanitize.py.
    return (
        f"Character portrait of {suspect.name}, a {suspect.age}-year-old {suspect.occupation}. "
        f"{suspect.personality} "
        "Black-and-white noir detective game headshot, dramatic film lighting, "
        "shoulders-up, photorealistic, moody atmosphere."
    )


async def add_suspect_portraits(case: Case) -> None:
    """Best-effort: generate and attach a noir portrait for each suspect
    that doesn't already have one, mutating `case.suspects` in place.

    Silently skips if Replicate isn't configured, and a single suspect's
    failure never blocks the others or the case — the frontend already
    falls back to initials when image_url is null.

    Runs sequentially rather than in parallel: this happens in the
    background case-pool loop where latency doesn't matter, and low-balance
    Replicate accounts are throttled to a burst of 1 concurrent prediction —
    firing them all at once would just trip that limit immediately.
    """
    settings = get_settings()
    if not settings.replicate_api_token:
        return

    for suspect in case.suspects:
        if suspect.image_url:
            continue
        try:
            suspect.image_url = await generate_and_store_image(
                _portrait_prompt(suspect), folder="detective-k/suspects"
            )
        except HTTPException:
            logger.warning(
                "Portrait generation skipped for suspect %s (%s)", suspect.id, suspect.name
            )


# Evidence types worth an image — the rest (report, witness_statement, email,
# phone_record, receipt, security_log) stay text-only.
_VISUAL_EVIDENCE_TYPES = {"photo", "cctv"}


def _evidence_prompt(evidence: Evidence) -> str:
    # Built only from PUBLIC-shaped facts (canonical_facts is never sent to the
    # frontend, but it also never names a suspect or the culprit — see
    # prompts.CASE_GENERATION rule 15) — the description is a fallback for
    # cases generated before canonical_facts was required for visual evidence.
    facts = " ".join(evidence.canonical_facts) if evidence.canonical_facts else evidence.description
    if evidence.type == "cctv":
        return (
            f"Black-and-white grainy CCTV security camera still frame capturing: {facts} "
            "Low-resolution surveillance footage aesthetic, timestamp-corner framing, wide "
            "angle lens distortion, any figures shown from a distance or partially obscured "
            "so faces are not clearly identifiable, no readable on-screen text or captions."
        )
    return (
        f"Photorealistic evidence photograph for a detective case file, depicting: {facts} "
        "Documentary crime-scene photography style, natural lighting, no readable text or "
        "logos, avoid any clearly identifiable face — focus on the scene and objects."
    )


async def add_evidence_images(case: Case) -> None:
    """Best-effort: generate and attach an image for each photo/cctv evidence
    item that doesn't already have one, mutating `case.evidence` in place.

    Same silent-skip and sequential-generation rationale as
    add_suspect_portraits above.
    """
    settings = get_settings()
    if not settings.replicate_api_token:
        return

    for item in case.evidence:
        if item.media_url or item.type not in _VISUAL_EVIDENCE_TYPES:
            continue
        try:
            item.media_url = await generate_and_store_image(
                _evidence_prompt(item), folder="detective-k/evidence", aspect_ratio="16:9"
            )
        except HTTPException:
            logger.warning("Evidence image skipped for %s (%s)", item.id, item.title)
