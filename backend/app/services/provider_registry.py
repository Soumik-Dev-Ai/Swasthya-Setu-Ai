"""Model-agnostic provider registry (doc 06, phase "gap closure").

The three consumer services (vision, reasoning, ETL) used to hardcode LLM
model names in static cascade tuples. Every time a provider deprecates a
model (e.g. Groq retiring its Llama-3.2 vision line), those hardcoded
cascades silently broke. This registry makes the cascade model-agnostic:

- At startup (`refresh_providers`), each provider whose API key is set is
  health-checked with a trivial prompt (5s timeout), trying the candidate
  models in largest-first order. The first model that returns a 200 is
  remembered; providers that fail every candidate log a clear warning.
- `get_cascade(capability)` returns `[(env_key, model_string), ...]` for
  the capability's providers, in preference order, using the discovered
  model. Before the startup probe has run (e.g. in tests, where the ASGI
  lifespan does not execute), it falls back to each provider's first
  candidate — filtered to providers whose key is set — so behaviour is
  identical to the previous static cascade and no test depends on probing.
- No re-discovery ever happens mid-request: the registry is refreshed only
  at startup, keeping the request path fast and deterministic.

Rules honoured here (description is not an implementation):
- No timeout/graceful-degradation/grounding/safety changes leak in —
  those remain the property of the consumer modules.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger("swasthyasetu")

# env-key → {model candidates (largest/best first), override setting name}.
# Candidate order is the preference order used by the startup probe.
_PROVIDERS: dict[str, dict[str, Any]] = {
    "GEMINI_API_KEY": {
        "override": "GEMINI_MODEL_OVERRIDE",
        "models": (
            "gemini/gemini-2.0-flash",
            "gemini/gemini-1.5-flash",
            "gemini/gemini-1.5-pro",
        ),
    },
    "NVIDIA_API_KEY": {
        "override": "NVIDIA_MODEL_OVERRIDE",
        "models": (
            "nvidia_nim/meta/llama-3.2-90b-vision-instruct",
            "nvidia_nim/meta/llama-3.2-11b-vision-instruct",
            "nvidia_nim/meta/llama-3.1-8b-instruct",
        ),
    },
    "GROQ_API_KEY": {
        "override": "GROQ_MODEL_OVERRIDE",
        "models": (
            "groq/qwen/qwen3.8-27b",
            "groq/openai/gpt-oss-120b",
            "groq/openai/gpt-oss-20b",
            "groq/llama-3.3-70b-versatile",
            "groq/llama-3.1-70b-versatile",
            "groq/llama-3.1-8b-instant",
        ),
    },
}

# capability → provider env-keys, in cascade preference order. Mirrors the
# original static cascades: vision never includes Groq (its vision models
# are decommissioned), text/extraction include all three.
_CAPABILITY_ORDER: dict[str, tuple[str, ...]] = {
    "vision": ("GEMINI_API_KEY", "NVIDIA_API_KEY"),
    "text": ("GEMINI_API_KEY", "NVIDIA_API_KEY", "GROQ_API_KEY"),
    "extraction": ("GEMINI_API_KEY", "NVIDIA_API_KEY", "GROQ_API_KEY"),
}

DEFAULT_CAPABILITY = "text"

# Startup probe results: env_key → resolved model string. Empty until
# `refresh_providers` has run once.
_resolved: dict[str, str] = {}


def _candidate_models(env_key: str) -> tuple[str, ...]:
    """Ordered candidate models for a provider, honouring its override."""
    provider = _PROVIDERS[env_key]
    override = getattr(settings, provider["override"], "") or ""
    if override.strip():
        return (override.strip(),)
    return provider["models"]


def get_cascade(capability: str) -> list[tuple[str, str]]:
    """Return [(env_key, model_string), ...] for `capability`.

    capability: "vision" | "text" | "extraction".

    Only providers whose API key is set are included. Each provider maps to
    the model it resolved at startup, or — before discovery has run — its
    first candidate, so the cascade is usable in any context.
    """
    order = _CAPABILITY_ORDER.get(capability, _CAPABILITY_ORDER[DEFAULT_CAPABILITY])
    cascade: list[tuple[str, str]] = []
    for env_key in order:
        if not getattr(settings, env_key, ""):
            continue
        model = _resolved.get(env_key) or _candidate_models(env_key)[0]
        cascade.append((env_key, model))
    return cascade


async def _probe(env_key: str, model: str) -> bool:
    """Health-check one model with a trivial prompt (5s cap). Returns True
    only on a clean 200-style completion."""
    try:
        import litellm  # type: ignore

        await asyncio.wait_for(
            litellm.acompletion(
                model=model,
                api_key=getattr(settings, env_key, ""),
                messages=[{"role": "user", "content": "Reply OK"}],
                temperature=0.0,
                max_tokens=4,
            ),
            timeout=5.0,
        )
        return True
    except Exception:
        return False


async def _discover_provider(env_key: str) -> None:
    """Probe a single provider's candidates in order; remember the first hit."""
    candidates = _candidate_models(env_key)
    for model in candidates:
        assert isinstance(model, str)
        if await _probe(env_key, model):
            _resolved[env_key] = model
            logger.info("[ProviderRegistry] %s: %s ✓", env_key, model)
            return
        logger.info("[ProviderRegistry] %s: %s ✗", env_key, model)
    logger.warning(
        "[ProviderRegistry] WARNING: %s is set but all model probes failed. "
        "Check if the key is valid or if your free-tier quota is exhausted.",
        env_key,
    )


async def refresh_providers() -> None:
    """Run all configured providers' health checks concurrently (startup only).

    A provider with no API key is skipped entirely. Providers with a key
    probe their candidates in order and remember the first usable model.
    Never raises — a failed probe is a warning, not a crash, because every
    consumer already degrades gracefully on an empty cascade.
    """
    configured = [k for k in _PROVIDERS if getattr(settings, k, "")]
    if not configured:
        logger.info("[ProviderRegistry] no provider API keys set — cascades will run degraded/offline")
        return
    _resolved.clear()
    results = await asyncio.gather(
        *(_discover_provider(k) for k in configured),
        return_exceptions=True,
    )
    for key, result in zip(configured, results):
        if isinstance(result, Exception):
            logger.warning("[ProviderRegistry] %s probe errored: %s", key, result)


__all__ = ["get_cascade", "refresh_providers"]