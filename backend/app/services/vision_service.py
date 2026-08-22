"""Vision LLM cascade service.

Routes an uploaded medical image through Gemini → Groq → NVIDIA via
litellm, falling through on failure/timeout. Per the V3 deep-integration
spec, this output is a *signal*, never a verdict — the deterministic
safety layer (services.safety_layer.enforce_red_flag_safety) makes the
final urgency call.

Output contract:
- `visual_symptom_category`: one of the curated condition IDs from
  v2_data.CONDITIONS, or "unknown".
- `visual_urgency_signal`: "emergency" | "non_serious" | "uncertain".
- `confidence`: 0–100.
- `model_version`: which cascade stage produced the result.
- `source`: "vision_llm_cascade".

The vision model is NEVER asked to give diagnosis, treatment, or
home-care advice. Prompt is hard-coded to structured output only.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
from dataclasses import dataclass
from typing import Any

from . import v2_data
from .cache import vision_cache
from ..core.config import settings

logger = logging.getLogger(__name__)


# Allowed symptom categories. Reuses the existing taxonomy verbatim —
# no parallel taxonomy is invented.
ALLOWED_CATEGORIES: tuple[str, ...] = tuple(c["id"] for c in v2_data.CONDITIONS) + ("unknown",)

URGENCY_EMERGENCY = "emergency"
URGENCY_NON_SERIOUS = "non_serious"
URGENCY_UNCERTAIN = "uncertain"
ALLOWED_URGENCY: tuple[str, ...] = (URGENCY_EMERGENCY, URGENCY_NON_SERIOUS, URGENCY_UNCERTAIN)


@dataclass
class VisionSignal:
    visual_symptom_category: str
    visual_urgency_signal: str
    confidence: int
    model_version: str
    source: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "visual_symptom_category": self.visual_symptom_category,
            "visual_urgency_signal": self.visual_urgency_signal,
            "confidence": self.confidence,
            "model_version": self.model_version,
            "source": self.source,
        }


# Hard-coded prompt. Critical: this is the *only* prompt the vision model
# sees. It constrains output to structured categories — no diagnosis,
# no treatment, no prose advice.
_VISION_PROMPT = (
    "You are a medical-image triage assistant. Classify the image ONLY "
    "into the structured fields below. Do NOT provide diagnosis, "
    "treatment, or home-care instructions.\n"
    "Output ONE JSON object on ONE line, no markdown, no prose:\n"
    "{ \"visual_symptom_category\": <one of: "
    + ", ".join(ALLOWED_CATEGORIES)
    + ">, \"visual_urgency_signal\": <one of: emergency | non_serious | uncertain>, "
    "\"confidence\": <0-100 int> }\n"
)


# (env-key-name, litellm model string). Order = cascade order.
_CASCADE: tuple[tuple[str, str], tuple[str, str], tuple[str, str]] = (
    ("GEMINI_API_KEY", "gemini/gemini-1.5-flash"),
    ("GROQ_API_KEY", "groq/llama-3.2-90b-vision-preview"),
    ("NVIDIA_API_KEY", "nvidia/llama-3.1-70b-instruct"),
)


def _encode_image_for_llm(image_bytes: bytes, mime_type: str) -> dict[str, str]:
    """Encode uploaded bytes for litellm vision providers."""
    b64 = base64.b64encode(image_bytes).decode("ascii")
    return {
        "type": "image_url",
        "image_url": {"url": f"data:{mime_type};base64,{b64}"},
    }


def _parse_vision_output(text: str) -> VisionSignal | None:
    """Defensive JSON parse of the model's one-line response."""
    if not text:
        return None
    fenced = re.search(r"\{.*\}", text, re.DOTALL)
    if not fenced:
        return None
    try:
        obj = json.loads(fenced.group(0))
    except json.JSONDecodeError:
        return None

    category = str(obj.get("visual_symptom_category", "unknown")).strip().lower()
    if category not in ALLOWED_CATEGORIES:
        # Map free-form outputs onto the closest known bucket, then to unknown.
        category = "unknown"

    urgency = str(obj.get("visual_urgency_signal", URGENCY_UNCERTAIN)).strip().lower()
    if urgency not in ALLOWED_URGENCY:
        urgency = URGENCY_UNCERTAIN

    try:
        confidence = max(0, min(100, int(obj.get("confidence", 0))))
    except (TypeError, ValueError):
        confidence = 0

    return VisionSignal(
        visual_symptom_category=category,
        visual_urgency_signal=urgency,
        confidence=confidence,
        model_version="parsed",
        source="vision_llm_cascade",
    )


async def analyze_image(
    *,
    image_bytes: bytes,
    mime_type: str,
    symptoms_text: str = "",
) -> VisionSignal:
    """Run the vision cascade over the uploaded image.

    Returns a VisionSignal always; on every-provider-fail returns a
    `uncertain` signal with confidence=0. Never raises — the safety
    layer is designed to be safe on uncertain input.
    """
    # Stable cache key on image bytes (small SHA) + symptoms excerpt.
    import hashlib

    h = hashlib.sha256(image_bytes).hexdigest()[:24]
    cache_key = vision_cache.make_key("vision", h, mime_type, symptoms_text[:80])
    cached = await vision_cache.get(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    if not _any_vision_key_set():
        signal = VisionSignal(
            visual_symptom_category="unknown",
            visual_urgency_signal=URGENCY_UNCERTAIN,
            confidence=0,
            model_version="cascade.no_keys",
            source="vision_llm_cascade",
        )
        await vision_cache.set(cache_key, signal, ttl_seconds=settings.CACHE_TTL_SECONDS)
        return signal

    image_part = _encode_image_for_llm(image_bytes, mime_type)
    user_content: list[dict[str, Any]] = [
        {"type": "text", "text": _VISION_PROMPT},
        image_part,
    ]
    if symptoms_text:
        user_content.append({"type": "text", "text": f"Patient symptoms: {symptoms_text[:400]}"})

    last_err = ""
    for env_key, model in _CASCADE:
        api_key = getattr(settings, env_key, "")
        if not api_key:
            continue
        try:
            import litellm  # type: ignore
            response = await asyncio.wait_for(
                litellm.acompletion(
                    model=model,
                    api_key=api_key,
                    messages=[{"role": "user", "content": user_content}],
                    temperature=0.0,
                    max_tokens=120,
                ),
                timeout=15.0,
            )
            text = (response.choices[0].message.content or "").strip()
            signal = _parse_vision_output(text)
            if signal is not None:
                signal.model_version = f"cascade.{model}"
                await vision_cache.set(cache_key, signal, ttl_seconds=settings.CACHE_TTL_SECONDS)
                return signal
            last_err = f"{model}: parse-failed"
        except asyncio.TimeoutError:
            last_err = f"{model}: timeout"
            logger.warning("Vision cascade %s timed out", model)
        except Exception as exc:
            last_err = f"{model}: {exc}"
            logger.warning("Vision cascade %s failed: %s", model, exc)

    signal = VisionSignal(
        visual_symptom_category="unknown",
        visual_urgency_signal=URGENCY_UNCERTAIN,
        confidence=0,
        model_version=f"cascade.failed",
        source="vision_llm_cascade",
    )
    await vision_cache.set(cache_key, signal, ttl_seconds=settings.CACHE_TTL_SECONDS)
    return signal


def _any_vision_key_set() -> bool:
    return bool(settings.GEMINI_API_KEY or settings.GROQ_API_KEY or settings.NVIDIA_API_KEY)


__all__ = [
    "VisionSignal",
    "URGENCY_EMERGENCY",
    "URGENCY_NON_SERIOUS",
    "URGENCY_UNCERTAIN",
    "analyze_image",
]
