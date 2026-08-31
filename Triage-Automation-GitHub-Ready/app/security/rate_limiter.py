"""Lightweight in-memory rate limiter for public webhook endpoints.

Uses a sliding window algorithm with thread safety.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict


class InMemoryRateLimiter:
    """Sliding-window in-memory rate limiter."""

    def __init__(self, default_limit: int = 60, default_window_seconds: int = 60) -> None:
        self.default_limit = default_limit
        self.default_window_seconds = default_window_seconds
        self._lock = threading.Lock()
        self._requests: dict[str, list[float]] = defaultdict(list)

    def is_rate_limited(
        self,
        key: str,
        limit: int | None = None,
        window_seconds: int | None = None,
    ) -> bool:
        """Check if ``key`` has exceeded its request limit.

        Returns ``True`` if rate-limited, ``False`` if request is allowed.
        """
        max_requests = limit if limit is not None else self.default_limit
        window = window_seconds if window_seconds is not None else self.default_window_seconds
        now = time.time()
        cutoff = now - window

        with self._lock:
            # Prune expired timestamps
            timestamps = [ts for ts in self._requests[key] if ts > cutoff]
            if len(timestamps) >= max_requests:
                self._requests[key] = timestamps
                return True

            timestamps.append(now)
            self._requests[key] = timestamps
            return False

    def reset(self) -> None:
        """Clear all rate limit tracking (useful for unit tests)."""
        with self._lock:
            self._requests.clear()


# Default global rate limiter instance (60 requests per minute per webhook_token)
global_rate_limiter = InMemoryRateLimiter(default_limit=60, default_window_seconds=60)
