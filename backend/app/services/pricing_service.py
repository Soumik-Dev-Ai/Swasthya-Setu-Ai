"""Pricing service: curated-first, scrape/LLM fallback.

Three-step pipeline per Phase 1.1 of the V3 deep-integration spec:

1. CURATED LOOKUP — check `v2_data.DISEASES` (in-memory authoritative
   dataset). This is the single source of truth whenever it has a match.
   Result is tagged `source: "verified_official_data"`.

2. (Optional) WEB SCRAPE — only if `ENABLE_WEB_SCRAPE=true` in config
   AND no curated match. Default-off per AI Ethics Rule 4 (no
   fabricated pricing). Uses duckduckgo-search to gather local cost
   pages.

3. LLM EXTRACTION CASCADE — only if scrape returned text. Routes the
   scraped text through Gemini → Groq → NVIDIA via litellm, falling
   through on failure/timeout. Extracts a structured price estimate.
   Result is tagged `source: "community_estimate_unverified"`.

All cost lookups are cached (`cost_cache`, 24h TTL default). Failures
at any stage degrade gracefully — the endpoint can still return a
facility list without a price estimate, never a hard 500.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any

from . import v2_data
from .cache import cost_cache
from ..core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public types
# ---------------------------------------------------------------------------

VERIFIED_SOURCE = "verified_official_data"
COMMUNITY_SOURCE = "community_estimate_unverified"
NO_ESTIMATE = "no_estimate_available"


@dataclass
class PriceEstimate:
    """Result of a pricing lookup. Always returned; never raises."""

    source: str  # one of the *_SOURCE constants above
    amount_inr: int | None
    confidence: int  # 0–100; 0 if no estimate available
    notes: str = ""
    model_version: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "amount_inr": self.amount_inr,
            "confidence": self.confidence,
            "notes": self.notes,
            "model_version": self.model_version,
        }


# ---------------------------------------------------------------------------
# Step 1: Curated lookup
# ---------------------------------------------------------------------------

def _lookup_curated(disease_id: str | None, severity: str | None) -> PriceEstimate | None:
    """Authoritative lookup. Returns None if no curated entry exists."""
    if not disease_id:
        return None
    disease = v2_data.disease_by_id(disease_id)
    if disease.get("id") != disease_id:
        # disease_by_id falls back to DISEASES[0] when not found —
        # we treat that as a miss.
        return None
    sev_index = v2_data.SEVERITY_INDEX.get(severity or "", 0)
    base_array: list[int] = disease.get("base", [])
    if not base_array:
        return None
    idx = max(0, min(sev_index, len(base_array) - 1))
    amount = int(base_array[idx])
    return PriceEstimate(
        source=VERIFIED_SOURCE,
        amount_inr=amount,
        confidence=95,
        notes=f"Curated PM-JAY/NLEM-aligned reference for {disease.get('nameKey', disease_id)} at {severity or 'mild'} severity.",
        model_version="v2_data.curated",
    )


# ---------------------------------------------------------------------------
# Step 2: Web scrape (gated by ENABLE_WEB_SCRAPE)
# ---------------------------------------------------------------------------

async def _scrape_cost_info(query: str, location: str) -> list[str]:
    """Run duckduckgo-search and return plain-text snippets.

    Returns [] on any failure (timeout, library missing, rate-limit).
    Never raises. Gated by `settings.ENABLE_WEB_SCRAPE` — caller must
    check before invoking.
    """
    if not settings.ENABLE_WEB_SCRAPE:
        return []
    try:
        from duckduckgo_search import DDGS  # type: ignore
    except ImportError:
        logger.warning("duckduckgo-search not installed; skipping scrape")
        return []

    full_query = f"{query} cost in {location} India" if location else f"{query} cost India"
    snippets: list[str] = []
    try:
        # DDGS is synchronous; run in a thread to avoid blocking the loop.
        def _search() -> list[str]:
            out: list[str] = []
            with DDGS() as ddgs:
                for r in ddgs.text(full_query, max_results=6, region="in-en"):
                    body = r.get("body") or r.get("snippet") or ""
                    if body:
                        out.append(body)
            return out

        snippets = await asyncio.wait_for(
            asyncio.to_thread(_search),
            timeout=8.0,
        )
    except asyncio.TimeoutError:
        logger.warning("duckduckgo scrape timed out for query=%s", query)
    except Exception as exc:
        logger.warning("duckduckgo scrape failed for query=%s: %s", query, exc)
    return snippets


# ---------------------------------------------------------------------------
# Step 3: LLM cascade (Gemini → Groq → NVIDIA)
# ---------------------------------------------------------------------------

_VISION_PROMPT_DISABLED = (
    "Scraped cost snippets follow. Return ONLY a single JSON object on one line:\n"
    "{ \"amount_inr\": <int|0 if unknown>, \"confidence\": <0-100 int> }\n"
    "Do not include any prose, explanation, or markdown fences.\n"
)

# Registry-served cascade (phase-5 item 5D): providers whose keys are
# configured, preference-ordered — model names are never hardcoded here.
# from app.services.provider_registry import get_cascade  (imported lazily below)


async def _extract_price_with_llm(snippets: list[str]) -> PriceEstimate:
    """Run the litellm cascade over scraped snippets. Never raises.

    On all-providers-fail: returns a `community_estimate_unverified`
    result with amount=None and confidence=0.
    """
    if not snippets:
        return PriceEstimate(
            source=COMMUNITY_SOURCE,
            amount_inr=None,
            confidence=0,
            notes="No scraped snippets available for extraction.",
            model_version="cascade.unavailable",
        )

    from app.services.provider_registry import get_cascade

    body = "\n".join(snippets[:6])
    last_err: str = ""

    for env_key, model in get_cascade("text"):
        api_key = getattr(settings, env_key, "")
        if not api_key:
            continue
        try:
            import litellm  # type: ignore
            response = await asyncio.wait_for(
                litellm.acompletion(
                    model=model,
                    api_key=api_key,
                    messages=[
                        {"role": "system", "content": _VISION_PROMPT_DISABLED},
                        {"role": "user", "content": body},
                    ],
                    temperature=0.0,
                    max_tokens=120,
                ),
                timeout=1.0,
            )
            text = (response.choices[0].message.content or "").strip()
            amount, confidence = _parse_cascade_output(text)
            return PriceEstimate(
                source=COMMUNITY_SOURCE,
                amount_inr=amount,
                confidence=confidence,
                notes="Community-sourced estimate — not verified against official pricing.",
                model_version=f"cascade.{model}",
            )
        except asyncio.TimeoutError:
            last_err = f"{model}: timeout"
            logger.warning("LLM cascade %s timed out", model)
        except Exception as exc:
            last_err = f"{model}: {exc}"
            logger.warning("LLM cascade %s failed: %s", model, exc)

    return PriceEstimate(
        source=COMMUNITY_SOURCE,
        amount_inr=None,
        confidence=0,
        notes=f"All cascade providers failed ({last_err or 'no keys configured'}).",
        model_version="cascade.failed",
    )


def _parse_cascade_output(text: str) -> tuple[int | None, int]:
    """Parse a one-line JSON object from the LLM, defensively."""
    import json
    import re

    if not text:
        return None, 0
    # Strip markdown fences if the model added them despite instructions.
    fenced = re.search(r"\{.*\}", text, re.DOTALL)
    if not fenced:
        return None, 0
    try:
        obj = json.loads(fenced.group(0))
        amount_raw = obj.get("amount_inr", 0)
        try:
            amount = int(amount_raw) if amount_raw else None
        except (TypeError, ValueError):
            amount = None
        conf_raw = obj.get("confidence", 0)
        try:
            confidence = max(0, min(100, int(conf_raw)))
        except (TypeError, ValueError):
            confidence = 0
        return amount, confidence
    except json.JSONDecodeError:
        return None, 0


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def get_price_estimate(
    *,
    disease_id: str | None = None,
    severity: str | None = None,
    query: str | None = None,
    location: str | None = None,
) -> PriceEstimate:
    """Curated-first price lookup with optional scrape+LLM fallback.

    Returns a `PriceEstimate` always. Never raises. The `source` field
    lets the frontend visually distinguish verified vs. community
    estimates (required by V3 spec).
    """
    # Step 1: curated.
    curated = _lookup_curated(disease_id, severity)
    if curated is not None:
        return curated

    # Steps 2 + 3: gated by config.
    if not settings.ENABLE_WEB_SCRAPE:
        return PriceEstimate(
            source=NO_ESTIMATE,
            amount_inr=None,
            confidence=0,
            notes="No curated entry found. Community-estimate scrape is disabled (ENABLE_WEB_SCRAPE=false).",
            model_version="curated.miss",
        )

    # Cache key on the public inputs that drove the lookup.
    cache_key = cost_cache.make_key("price", disease_id, severity, query, location)
    cached = await cost_cache.get(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    snippets = await _scrape_cost_info(query or (disease_id or "medical procedure"), location or "")
    estimate = await _extract_price_with_llm(snippets)

    await cost_cache.set(cache_key, estimate, ttl_seconds=settings.CACHE_TTL_SECONDS)
    return estimate


async def lookup_as_of(db, disease_label: str | None) -> str | None:
    """Return the verification date of the freshest ACTIVE government-cost
    row matching this disease label, or None when only the curated static
    dataset covers it.

    The frontend is required to display this ("Estimated cost as of [date].")
    — doc 16 §2.2's end-user freshness contract.
    """
    if not disease_label:
        return None
    try:
        from sqlalchemy import select

        from app.models.government_cost import GovernmentCost

        needle = " ".join(str(disease_label).lower().split())
        if not needle:
            return None
        rows = (
            await db.execute(
                select(GovernmentCost).where(GovernmentCost.active.is_(True))
            )
        ).scalars().all()
        for row in rows:
            key = " ".join((row.procedure_key or "").lower().split())
            if key and (key in needle or needle in key):
                return row.last_verified_date.date().isoformat()
        return None
    except Exception:
        return None


__all__ = [
    "PriceEstimate",
    "VERIFIED_SOURCE",
    "COMMUNITY_SOURCE",
    "NO_ESTIMATE",
    "get_price_estimate",
    "lookup_as_of",
]
