"""Bearer-token auth. Two modes:

- DEV_AUTH_BYPASS=true (default): any/no token resolves to a local dev user,
  so the whole stack runs without a Clerk account.
- Clerk: verifies the session JWT against CLERK_JWKS_URL.
"""

import time

import httpx
from fastapi import Depends, HTTPException, Request
from jose import jwt
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.messages import ErrorMessages


class AuthUser(BaseModel):
    id: str
    name: str = "Detective"
    email: str | None = None
    avatar_url: str | None = None


_jwks_cache: dict = {"keys": None, "fetched_at": 0.0}


async def _get_jwks(url: str) -> dict:
    if _jwks_cache["keys"] is None or time.time() - _jwks_cache["fetched_at"] > 3600:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            _jwks_cache["keys"] = resp.json()
            _jwks_cache["fetched_at"] = time.time()
    return _jwks_cache["keys"]


async def get_current_user(request: Request) -> AuthUser:
    settings = get_settings()
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()

    if settings.dev_auth_bypass:
        return AuthUser(id="dev-user", name="Guest Detective")

    if not token:
        raise HTTPException(status_code=401, detail=ErrorMessages.MISSING_BEARER_TOKEN)
    if not settings.clerk_jwks_url:
        raise HTTPException(status_code=500, detail=ErrorMessages.AUTH_NOT_CONFIGURED)

    try:
        jwks = await _get_jwks(settings.clerk_jwks_url)
        # Pin the algorithm (never trust the token header) and verify the
        # issuer when one is configured.
        claims = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            issuer=settings.clerk_issuer or None,
            options={"verify_aud": False, "verify_iss": bool(settings.clerk_issuer)},
        )
    except Exception:
        raise HTTPException(status_code=401, detail=ErrorMessages.INVALID_TOKEN)

    return AuthUser(
        id=claims["sub"],
        name=claims.get("name") or claims.get("first_name") or "Detective",
        email=claims.get("email"),
        avatar_url=claims.get("picture") or claims.get("image_url"),
    )


CurrentUser = Depends(get_current_user)
