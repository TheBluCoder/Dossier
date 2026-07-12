"""Tiny in-memory per-user rate limiter for the expensive AI endpoints.

Good enough for a single-process deployment; swap for Redis if the backend
ever runs more than one replica.
"""

import time
from collections import deque

from fastapi import HTTPException

from app.core.messages import ErrorMessages

_buckets: dict[str, deque[float]] = {}


def check_rate_limit(key: str, limit: int, window_seconds: float = 60.0) -> None:
    """Raise 429 when `key` has been used more than `limit` times in the window."""
    now = time.monotonic()
    bucket = _buckets.setdefault(key, deque())
    while bucket and now - bucket[0] > window_seconds:
        bucket.popleft()
    if len(bucket) >= limit:
        raise HTTPException(status_code=429, detail=ErrorMessages.RATE_LIMITED)
    bucket.append(now)
