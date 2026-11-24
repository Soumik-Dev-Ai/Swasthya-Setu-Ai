"""Mechanical grounding verification (doc 14 §5, doc 12 §A.3).

This runs in ordinary code — never a second LLM. Two checks:

1. Citation membership: the grounding_reference must be one of the chunk
   ids actually retrieved for this query (an invented citation fails).
2. Semantic overlap: the model's stated reason must share enough tokens
   with the cited chunk's text (the "phantom citation" / mismatched-metric
   guard) — a real citation the model didn't actually use also fails.

On failure the reasoning layer treats the output as a cascade-stage
failure and falls through — never to an unverified answer.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

from app.core.config import settings

_TOKEN_RE = re.compile(r"[a-z0-9\u0900-\u097f\u0980-\u09ff]+")


def _tokens(text: str) -> set[str]:
    return set(_TOKEN_RE.findall((text or "").lower()))


@dataclass(frozen=True)
class GroundingCheck:
    ok: bool
    reason: str  # machine-readable failure mode for logs/tests


def verify_grounding(
    *,
    grounding_reference: str | None,
    retrieved_chunk_ids: Iterable[str],
    claimed_reason: str,
    cited_chunk_text: str | None,
    min_overlap: float | None = None,
) -> GroundingCheck:
    min_overlap = settings.GROUNDING_MIN_OVERLAP if min_overlap is None else min_overlap

    if not grounding_reference:
        return GroundingCheck(False, "no_reference")
    ids = list(retrieved_chunk_ids)
    if grounding_reference not in ids:
        return GroundingCheck(False, "citation_not_retrieved")

    if not claimed_reason or not cited_chunk_text:
        return GroundingCheck(False, "missing_context")

    reason_toks = _tokens(claimed_reason)
    chunk_toks = _tokens(cited_chunk_text)
    if not reason_toks:
        return GroundingCheck(False, "empty_reason")

    overlap = len(reason_toks & chunk_toks) / len(reason_toks)
    if overlap < min_overlap:
        return GroundingCheck(False, f"low_overlap<{min_overlap:.2f}")
    return GroundingCheck(True, "verified")


__all__ = ["GroundingCheck", "verify_grounding"]
