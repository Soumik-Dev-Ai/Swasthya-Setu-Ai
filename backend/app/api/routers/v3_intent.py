"""V3 intent routing endpoint (doc 16 Task 1).

Pipeline order, always:
  1. Deterministic safety gate on 100% of inputs — a red flag short-circuits
     to an emergency response regardless of what the classifier would say.
  2. Intent classification: deterministic keywords first; the single LLM
     fallback call only ever fires when no keyword evidence exists at all.
  3. Mixed intent ("both") executes BOTH pipelines in one response, using
     the standardized double-JSON wrapper, so nothing is silently dropped.
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.limiter import limiter
from app.db import get_db
from app.schemas.care import IntentRequest, IntentResponse, ReasonRequest
from app.services import intent_classifier
from app.services import v2_data as D
from app.services import v2_engine as E
from app.services.reasoning_engine import analyze_text
from app.services.safety_layer import enforce_red_flag_safety

router = APIRouter()

import logging

logger = logging.getLogger("swasthyasetu")


def _run_financial_pipeline(payload: IntentRequest) -> dict:
    """Deterministic-only financial path — no LLM is ever inserted here
    (docs/15 §4). With structured context: a curated cost estimate. Without
    it: an explicit 'needs structured input' marker, never a guess."""
    ctx = payload.context
    if ctx and ctx.diseaseId and ctx.severity:
        hospital_id = ctx.hospitalId or D.HOSPITALS[0]["id"]
        total = E.estimate_cost(hospital_id, ctx.diseaseId, ctx.severity)
        hospital = D.hospital_by_id(hospital_id)
        return {
            "status": "ok",
            "source": "verified_official_data",
            "diseaseId": ctx.diseaseId,
            "hospitalId": hospital["id"],
            "hospitalName": hospital.get("nameKey", hospital["id"]),
            "severity": ctx.severity,
            "total": total,
        }
    return {
        "status": "needs_structured_input",
        "required": ["diseaseId", "severity", "(optional) hospitalId/cityId"],
    }


def _run_symptom_pipeline(payload: IntentRequest) -> dict:
    """Deterministic triage (no vision signal on this text-only route)."""
    return E.run_triage_v3(text=payload.text, flags=payload.flags, vision_signal=None)


@router.post("/intent", response_model=IntentResponse)
@limiter.limit(settings.PUBLIC_HEAVY_RATE_LIMIT)
async def route_intent(
    request: Request,
    payload: IntentRequest,
    db: AsyncSession = Depends(get_db),
) -> IntentResponse:
    # 1. Safety gate first — on every input, unconditionally.
    verdict = enforce_red_flag_safety(
        symptoms_text=payload.text,
        frontend_flags=payload.flags,
        text_level=1,
        visual_urgency_signal=None,
    )
    if verdict.emergency:
        # Phase 1 item 1F: persist the override event for audit — same
        # privacy pattern as v2_engine._log_safety_overrides: SHA-256
        # digest only, NEVER raw symptom text. Never breaks triage.
        try:
            import hashlib

            from app.models.safety_override import SafetyOverrideLog

            digest = hashlib.sha256(payload.text.encode("utf-8")).hexdigest()[:64]
            db.add(SafetyOverrideLog(
                override_type="deterministic_red_flag",
                text_signal="red_flag",
                vision_signal=None,
                triggered_keywords=list(verdict.triggered_keywords),
                symptoms_hash=digest,
            ))
            await db.flush()
        except Exception as exc:  # pragma: no cover — defensive
            logger.warning("Safety override logging failed in v3_intent: %s", exc)
        # A red flag overrides any routing decision: forced to the symptom
        # pipeline at full urgency, with the audit trail attached.
        return IntentResponse(
            intent="symptom",
            confidence=1.0,
            method="safety_gate",
            emergency=True,
            safety={
                "level": 4,
                "triggered_keywords": list(verdict.triggered_keywords),
                "vision_downgrade_blocked": verdict.vision_downgrade_blocked,
            },
            data={"triage_data": _run_symptom_pipeline(payload)},
        )

    # 2. Classify — deterministic pass; single-constrained LLM fallback only
    #    when the deterministic pass finds zero evidence.
    result = await intent_classifier.classify(payload.text)

    # 3. Route. "both" runs BOTH pipelines and ships the double-JSON wrapper.
    data: dict = {}
    if result.intent in ("symptom", "both"):
        data["triage_data"] = _run_symptom_pipeline(payload)
    if result.intent in ("cost_scheme", "both"):
        data["financial_data"] = _run_financial_pipeline(payload)

    return IntentResponse(
        intent=result.intent,  # type: ignore[arg-type]
        confidence=result.confidence,
        method=result.method,  # type: ignore[arg-type]
        emergency=False,
        data=data,
    )


@router.post("/reason")
@limiter.limit(settings.PUBLIC_HEAVY_RATE_LIMIT)
async def reason(request: Request, payload: ReasonRequest) -> dict:
    """Grounded text-path reasoning (doc 22 item 6).

    The deterministic gate runs first, as always: a red-flag input returns
    the L4 deferral without any LLM call. Non-red-flag text proceeds through
    retrieval → cascade → mechanical verifier.
    """
    gate = enforce_red_flag_safety(
        symptoms_text=payload.text, frontend_flags=payload.flags,
        text_level=1, visual_urgency_signal=None,
    )
    if gate.emergency:
        return {
            "deferred_to_gate": True,
            "emergency": True,
            "level": 4,
            "triggered_keywords": list(gate.triggered_keywords),
            "reasoning": {
                "severity_signal": "emergency",
                "finding_category": "red_flag",
                "confidence": 100,
                "reason": "Deterministic red flag; reasoning deferred to the safety gate.",
                "grounding_reference": None,
                "grounding_verified": False,
                "model_version": "reasoning.deferred_to_gate",
                "source": "reasoning_engine",
            },
        }
    result = await analyze_text(payload.text)
    return {
        "deferred_to_gate": False,
        "emergency": False,
        "reasoning": result.to_dict(),
    }
