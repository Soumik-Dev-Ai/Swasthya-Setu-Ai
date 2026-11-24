"""Embedding providers for the Knowledge Engine.

Two interchangeable backends selected by `EMBEDDING_MODEL`:

- "hash" (default): deterministic, dependency-free feature-hashing over
  word unigrams/bigrams — CI/offline-safe, reproducible tests.
- any sentence-transformers id (e.g. "intfloat/multilingual-e5-small"):
  real multilingual semantic embeddings with the E5 `query:`/`passage:`
  prefix convention. Cached once per process; falls back to hash on any
  load/inference failure so retrieval degrades, never crashes.

Dimension handling: vectors are stored as JSON and scored in-process, so a
model switch that changes output dimensionality invalidates already-stored
chunks — the retriever detects the mismatch and abstains with a clear
diagnostic instead of silently returning zero/empty results.
"""
from __future__ import annotations

import hashlib
import math
import re
from typing import Any

from app.core.config import settings

_TOKEN_RE = re.compile(r"[a-z0-9\u0900-\u097f\u0980-\u09ff]+")

# Per-process cache so a sentence-transformer model is loaded once, not
# once per query (an 11s load per query would be a latency bug).
_model_cache: tuple[str, Any | None] | None = None


def _tokens(text: str) -> list[str]:
    return [t for t in _TOKEN_RE.findall(text.lower()) if len(t) > 1]


def _ngrams(tokens: list[str]) -> list[str]:
    grams = list(tokens)
    grams.extend(f"{tokens[i]} {tokens[i + 1]}" for i in range(len(tokens) - 1))
    return grams


def _hash_embed(text: str, dim: int) -> list[float]:
    vec = [0.0] * dim
    for gram in _ngrams(_tokens(text)):
        digest = hashlib.sha256(gram.encode("utf-8")).digest()
        idx = int.from_bytes(digest[:4], "big") % dim
        sign = 1.0 if digest[4] & 1 else -1.0
        vec[idx] += sign
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def _load_model() -> Any | None:
    global _model_cache
    if _model_cache is not None and _model_cache[0] == settings.EMBEDDING_MODEL:
        return _model_cache[1]
    if settings.EMBEDDING_MODEL == "hash":
        _model_cache = (settings.EMBEDDING_MODEL, None)
        return None
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore

        try:
            model = SentenceTransformer(settings.EMBEDDING_MODEL, local_files_only=True)
        except Exception:
            model = SentenceTransformer(settings.EMBEDDING_MODEL)
    except Exception:
        model = None
    _model_cache = (settings.EMBEDDING_MODEL, model)
    return model


_query_cache: dict[str, list[float]] = {}


def embed_texts(texts: list[str], *, kind: str = "passage") -> list[list[float]]:
    """Embed a batch. kind="query" prefixes per the E5 convention; ignored
    for the hash profile. Never raises — hash regression on failure."""
    if settings.EMBEDDING_MODEL == "hash":
        return [_hash_embed(t, settings.EMBEDDING_DIM) for t in texts]

    if kind == "query" and len(texts) == 1 and texts[0] in _query_cache:
        return [_query_cache[texts[0]]]

    model = _load_model()
    if model is None:
        return [_hash_embed(t, settings.EMBEDDING_DIM) for t in texts]
    prefix = "query: " if kind == "query" else "passage: "
    try:
        vectors = model.encode([prefix + t for t in texts], normalize_embeddings=True)
        res = [list(map(float, v)) for v in vectors]
        if kind == "query":
            for t, v in zip(texts, res):
                if len(_query_cache) < 2000:
                    _query_cache[t] = v
        return res
    except Exception:
        return [_hash_embed(t, settings.EMBEDDING_DIM) for t in texts]


def model_dim() -> int:
    """Output dimensionality of the active profile (for mismatch detection)."""
    if settings.EMBEDDING_MODEL == "hash":
        return settings.EMBEDDING_DIM
    model = _load_model()
    if model is None:
        return settings.EMBEDDING_DIM
    try:
        return int(model.get_sentence_embedding_dimension())
    except Exception:
        return settings.EMBEDDING_DIM


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    return float(sum(x * y for x, y in zip(a, b)))


__all__ = ["embed_texts", "cosine", "model_dim"]