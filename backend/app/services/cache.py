"""Simple in-process TTL cache.

Used to memoize expensive external calls (web scrape + LLM cascade for
cost estimates, vision LLM analyses). Backed by a single asyncio Lock
to keep concurrent writes consistent.

This is intentionally in-memory only — restart-safe caching is out of
scope for the V3 deep integration (would need Redis). The cache is
defensive, not authoritative; misses always recompute.

Thread/async safety: a single `asyncio.Lock` guards all mutations.
Reads are lock-free and may briefly observe stale values during writes.
"""
from __future__ import annotations

import asyncio
import hashlib
import time
from dataclasses import dataclass
from typing import Any, Generic, TypeVar

T = TypeVar("T")


@dataclass
class CacheEntry(Generic[T]):
    value: T
    expires_at: float  # epoch seconds


class TTLCache:
    """In-process cache with per-key TTL and a hard size cap."""

    def __init__(self, *, max_size: int = 1024) -> None:
        self._store: dict[str, CacheEntry[Any]] = {}
        self._lock = asyncio.Lock()
        self._max_size = max_size
        # Hits/misses exposed for verification + smoke test introspection.
        self.hits = 0
        self.misses = 0

    @staticmethod
    def make_key(*parts: Any) -> str:
        """Stable, short cache key from heterogeneous parts."""
        h = hashlib.sha256()
        for p in parts:
            h.update(repr(p).encode("utf-8"))
            h.update(b"|")
        return h.hexdigest()[:32]

    async def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            self.misses += 1
            return None
        if entry.expires_at <= time.time():
            # Lazy eviction on read.
            self._store.pop(key, None)
            self.misses += 1
            return None
        self.hits += 1
        return entry.value

    async def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        async with self._lock:
            if len(self._store) >= self._max_size:
                # Naive eviction: drop oldest by expiry.
                now = time.time()
                expired = [k for k, v in self._store.items() if v.expires_at <= now]
                for k in expired:
                    self._store.pop(k, None)
                if len(self._store) >= self._max_size:
                    # Still full — drop the oldest expiry.
                    oldest_key = min(self._store, key=lambda k: self._store[k].expires_at)
                    self._store.pop(oldest_key, None)
            self._store[key] = CacheEntry(value=value, expires_at=time.time() + ttl_seconds)

    def stats(self) -> dict[str, int]:
        return {
            "size": len(self._store),
            "hits": self.hits,
            "misses": self.misses,
            "max_size": self._max_size,
        }

    def clear(self) -> None:
        self._store.clear()
        self.hits = 0
        self.misses = 0


# Singleton cache for the cost-engine fallback path.
cost_cache = TTLCache(max_size=512)


__all__ = ["TTLCache", "cost_cache"]
