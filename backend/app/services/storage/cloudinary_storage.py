"""Cloudinary-backed ImageStorage. One of possibly several implementations of
the interface in base.py — nothing outside this file should import cloudinary
directly.
"""

import asyncio
import io
import logging

import cloudinary
import cloudinary.uploader
from fastapi import HTTPException

from app.core.messages import ErrorMessages

logger = logging.getLogger(__name__)


class CloudinaryStorage:
    def __init__(self, cloud_name: str, api_key: str, api_secret: str) -> None:
        cloudinary.config(
            cloud_name=cloud_name, api_key=api_key, api_secret=api_secret, secure=True
        )

    async def upload(self, data: bytes, *, folder: str, public_id: str | None = None) -> str:
        def _upload() -> str:
            result = cloudinary.uploader.upload(
                io.BytesIO(data),
                folder=folder,
                public_id=public_id,
                resource_type="image",
                overwrite=True,
            )
            return result["secure_url"]

        try:
            return await asyncio.to_thread(_upload)
        except Exception:
            logger.exception("Cloudinary upload failed")
            raise HTTPException(status_code=502, detail=ErrorMessages.IMAGE_GENERATION_FAILED)
