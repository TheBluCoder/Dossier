"""Provider-agnostic media storage.

Generated images/video are produced by third-party AI providers (Replicate,
etc.) at URLs that are not guaranteed to stay alive — they must be re-hosted
somewhere durable before a URL is persisted in a case/investigation document.

`ImageStorage` (base.py) is the interface every backend implements. Swapping
providers means adding a new implementation and a branch in `get_storage()` —
nothing that calls `get_storage()` needs to change.
"""

from functools import lru_cache

from fastapi import HTTPException

from app.core.config import get_settings
from app.core.messages import ErrorMessages
from app.services.storage.base import ImageStorage
from app.services.storage.cloudinary_storage import CloudinaryStorage

__all__ = ["ImageStorage", "get_storage"]


@lru_cache
def get_storage() -> ImageStorage:
    settings = get_settings()
    if settings.storage_provider == "cloudinary":
        if not (
            settings.cloudinary_cloud_name
            and settings.cloudinary_api_key
            and settings.cloudinary_api_secret
        ):
            raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_CONFIGURED)
        return CloudinaryStorage(
            cloud_name=settings.cloudinary_cloud_name,
            api_key=settings.cloudinary_api_key,
            api_secret=settings.cloudinary_api_secret,
        )
    raise HTTPException(status_code=500, detail=ErrorMessages.STORAGE_PROVIDER_UNKNOWN)
