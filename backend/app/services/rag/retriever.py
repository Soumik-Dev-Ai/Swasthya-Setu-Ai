"""Hybrid retrieval over the chunk store (doc 14 §4).

Dense embedding similarity + lexical term overlap, blended. Retrieval has a
hard relevance floor: when nothing clears it, the caller gets an empty
result — abstention, not a low-quality match that the reasoning layer might
then ground on hallucination-prone parametric memory.

The index is in-process and rebuilt lazily per corpus; ingestion clears it.
At MVP scale (hundreds of chunks) an exact in-memory scan is both the
fastest and the simplest correct answer (doc 14 §3's own guidance).
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.knowledge import KnowledgeChunk
from app.services.rag.embeddings import cosine, embed_texts

logger = logging.getLogger("swasthyasetu")


@dataclass(frozen=True)
class ScoredChunk:
    chunk_id: str
    source_name: str
    section_path: str
    text: str
    score: float
    dense: float = 0.0
    lex: float = 0.0


class _Index:
    """Per-corpus in-memory index: texts, token sets, dense vectors."""

    def __init__(self) -> None:
        self.loaded_at = 0.0
        self.rows: list[tuple[str, str, str, str, list[float], frozenset[str], float]] = []


_INDEX_CACHE: dict[str, _Index] = {}
_INDEX_TTL_SECONDS = 3600


# Functional English stopwords — matching must carry clinical content words,
# not "how do I on the".
_STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are",
    "was", "were", "it", "its", "by", "with", "as", "at", "be", "been", "from",
    "that", "this", "these", "those", "there", "their", "they", "them", "he",
    "she", "his", "her", "him", "we", "you", "your", "i", "me", "my", "not",
    "no", "yes", "if", "then", "than", "so", "but", "what", "which", "who",
    "when", "where", "why", "how", "can", "could", "should", "would", "will",
    "do", "does", "did", "have", "has", "had", "having",
}


def _tokens(text: str) -> set[str]:
    import re

    return {
        t for t in re.findall(r"[a-z0-9\u0900-\u097f\u0980-\u09ff]+", text.lower())
        if t not in _STOPWORDS and len(t) > 1
    }


async def _load_index(db: AsyncSession, corpus: str) -> _Index:
    cached = _INDEX_CACHE.get(corpus)
    if cached is not None and (time.time() - cached.loaded_at) < _INDEX_TTL_SECONDS:
        return cached
    rows = (
        await db.execute(
            select(
                KnowledgeChunk.chunk_id,
                KnowledgeChunk.source_name,
                KnowledgeChunk.section_path,
                KnowledgeChunk.text,
                KnowledgeChunk.embedding_json,
            ).where(KnowledgeChunk.corpus == corpus)
        )
    ).all()
    idx = _Index()
    data = []
    for chunk_id, source_name, section_path, text, embedding_json in rows:
        try:
            dense = json.loads(embedding_json)
        except Exception:
            continue
        token_set = _tokens(text)
        data.append((chunk_id, source_name, section_path, text, dense, frozenset(token_set), 1.0))
    idx.rows = data
    idx.loaded_at = time.time()
    _INDEX_CACHE[corpus] = idx
    return idx


def invalidate_corpus_index(corpus: str | None = None) -> None:
    if corpus is None:
        _INDEX_CACHE.clear()
    else:
        _INDEX_CACHE.pop(corpus, None)


async def search_corpus(
    db: AsyncSession,
    query: str,
    *,
    corpus: str = "clinical",
    top_k: int | None = None,
    min_score: float | None = None,
) -> list[ScoredChunk]:
    """Hybrid retrieval with abstention. Never raises — empty list when the
    corpus is empty or nothing clears the relevance floor."""
    if not query or not query.strip():
        return []
    top_k = top_k or settings.RAG_TOP_K
    min_score = settings.RAG_MIN_SCORE if min_score is None else min_score

    idx = await _load_index(db, corpus)
    if not idx.rows:
        return []

    stored_dim = len(idx.rows[0][4])
    import asyncio
    q_dense = (await asyncio.to_thread(embed_texts, [query], kind="query"))[0]
    if stored_dim != len(q_dense):
        # Embedding profile changed since ingestion: an exact scan across
        # mismatched dims is meaningless. Abstain loudly, never silently.
        logger.warning(
            "corpus='%s' stored dim %d != query dim %d — re-ingest with current "
            "EMBEDDING_MODEL '%s'", corpus, stored_dim, len(q_dense), settings.EMBEDDING_MODEL,
        )
        return []

    q_set = _tokens(query)

    # Blend weights follow the active profile: hash is only weakly semantic
    # (lexical leads); a real model lets dense paraphrasing lead.
    semantic = settings.EMBEDDING_MODEL != "hash"
    dense_weight = 0.70 if semantic else 0.20
    lex_weight = 0.30 if semantic else 0.80

    scored: list[ScoredChunk] = []
    for chunk_id, source_name, section_path, text, dense, token_set, _norm in idx.rows:
        dense_score = max(0.0, cosine(q_dense, dense))
        lex_score = (
            len(q_set & token_set) / max(1, len(q_set | token_set)) if q_set else 0.0
        )
        score = dense_weight * dense_score + lex_weight * lex_score
        scored.append(
            ScoredChunk(chunk_id, source_name, section_path, text, score, dense_score, lex_score)
        )

    scored.sort(key=lambda c: c.score, reverse=True)
    top = scored[:top_k]
    if not top:
        return []

    # Abstention gate. Two modes:
    #  - hash profile: blended-score floor (settings.RAG_MIN_SCORE).
    #  - semantic profile: cross-script queries have zero lexical overlap but
    #    legitimately high dense similarity, while e5's dense baseline for
    #    unrelated text is still ~0.79 — so the gate is a single dense floor
    #    (settings.RAG_MIN_DENSE). Relevant cross-script queries measured
    #    ~0.86-0.90; gibberish ~0.79, which is what the floor separates.
    if settings.EMBEDDING_MODEL == "hash":
        grounded = top[0].score >= min_score
    else:
        grounded = top[0].dense >= settings.RAG_MIN_DENSE

    return top if grounded else []


__all__ = ["ScoredChunk", "search_corpus", "invalidate_corpus_index"]