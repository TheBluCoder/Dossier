from typing import Protocol


class ImageStorage(Protocol):
    """A place to durably host generated media and get back a public URL.

    Implementations must be safe to call from async code (wrap blocking SDKs
    in a thread) and should raise on failure rather than return an empty URL.
    """

    async def upload(self, data: bytes, *, folder: str, public_id: str | None = None) -> str:
        """Upload raw image bytes and return a publicly accessible URL."""
        ...
