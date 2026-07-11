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
        raise HTTPException(status_code=401, detail="Missing bearer token")
    if not settings.clerk_jwks_url:
        raise HTTPException(status_code=500, detail="CLERK_JWKS_URL not configured")

    try:
        jwks = await _get_jwks(settings.clerk_jwks_url)
        claims = jwt.decode(token, jwks, options={"verify_aud": False})
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    return AuthUser(
        id=claims["sub"],
        name=claims.get("name") or claims.get("first_name") or "Detective",
        email=claims.get("email"),
        avatar_url=claims.get("picture") or claims.get("image_url"),
    )


CurrentUser = Depends(get_current_user)
