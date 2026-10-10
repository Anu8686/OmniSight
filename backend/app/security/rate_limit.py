"""Small in-memory sliding-window rate limiter (single-process; use Redis for multi-instance)."""
from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status


class RateLimiter:
    def __init__(self, max_calls: int, per_seconds: int, name: str = "default"):
        self.max_calls, self.per, self.name = max_calls, per_seconds, name
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()

    def __call__(self, request: Request) -> None:
        key = f"{self.name}:{request.client.host if request.client else 'unknown'}"
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > self.per:
                q.popleft()
            if len(q) >= self.max_calls:
                raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests. Please slow down.")
            q.append(now)


auth_limiter = RateLimiter(max_calls=20, per_seconds=60, name="auth")
scan_limiter = RateLimiter(max_calls=30, per_seconds=60, name="scan")
