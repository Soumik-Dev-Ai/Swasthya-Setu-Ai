import asyncio
import logging
from duckduckgo_search import DDGS

logger = logging.getLogger(__name__)

DISCLAIMER_TEXT = "?? Disclaimer: This output is AI-generated and research-based, and cannot be true always. If you have a severe problem or severe pain, please consult a doctor immediately."

async def get_verified_sources(query: str, max_results: int = 2) -> list[dict]:
    def _search():
        out = []
        try:
            with DDGS() as ddgs:
                for r in ddgs.text(query, max_results=max_results, region="in-en"):
                    if r.get("body"):
                        out.append({"title": r.get("title", ""), "url": r.get("href", "")})
        except Exception as e:
            logger.warning(f"OSINT scrape failed: {e}")
        return out

    try:
        sources = await asyncio.wait_for(asyncio.to_thread(_search), timeout=3.5)
    except Exception:
        sources = []
    return sources

async def apply_precision(query: str) -> dict:
    osint_query = f"site:nih.gov OR site:who.int OR site:mayoclinic.org {query}"
    sources = await get_verified_sources(osint_query)
    return {
        "verified_sources": sources,
        "disclaimer": DISCLAIMER_TEXT
    }
