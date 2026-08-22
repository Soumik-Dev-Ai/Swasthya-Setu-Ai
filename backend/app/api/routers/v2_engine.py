"""V2 engine router — 8 endpoints powering the migrated frontend.

V3 deep integration adds:
  - POST /api/facilities/advanced-search  (curated-first pricing + maps)
  - Multipart image upload on POST /api/triage/analyze (vision signal)

Paths are mounted under `/api` to exactly match the contracts the
frontend's `engine.ts` consumes (e.g. `POST /api/triage/analyze`).
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException, Request, UploadFile

from app.core.config import settings
from app.core.limiter import limiter
from app.schemas.v2 import (
    AnalyzePolicyRequest,
    CostAlternativesRequest,
    CostEstimateRequest,
    CoverageReportOut,
    EmergencyCaseOut,
    EmergencyHitOut,
    EmergencyRouteRequest,
    FacilitiesSearchRequest,
    FacilityAdvancedOut,
    FacilityHitOut,
    SchemeMatchOut,
    SchemeMatchRequest,
    CostEstimateOut,
    TriageAnalyzeRequest,
    TriageResultOut,
)
from app.services import v2_data as D
from app.services import v2_engine as E

logger = logging.getLogger(__name__)

router = APIRouter()


# 1. POST /api/triage/analyze  (V3: now accepts optional multipart image)
@router.post("/triage/analyze", response_model=TriageResultOut)
async def triage_analyze(request: Request) -> dict:
    """Triage analyze endpoint.

    Two request shapes are supported (selected by Content-Type):
    - `application/json` body (existing): `{symptoms, flags, age?, gender?}`
    - `multipart/form-data` (V3): form fields `symptoms` + `flags` (JSON
      string or comma-separated) + optional `image` file part.

    When an image is attached, it is routed through the vision cascade;
    the vision signal is then fed INTO the deterministic safety layer
    (never around it). The safety layer is the final authority on
    urgency, regardless of what the vision model said.
    """
    content_type = (request.headers.get("content-type") or "").lower()

    body_symptoms = ""
    body_flags: list[str] = []
    body_age: str | None = None
    body_gender: str | None = None
    image: UploadFile | None = None

    if "multipart/form-data" in content_type:
        form = await request.form()
        body_symptoms = str(form.get("symptoms", "")).strip()
        flags_raw = form.get("flags")
        if flags_raw:
            flags_str = str(flags_raw)
            try:
                body_flags = json.loads(flags_str) if flags_str.startswith("[") else [f.strip() for f in flags_str.split(",") if f.strip()]
            except (json.JSONDecodeError, ValueError):
                body_flags = [f.strip() for f in flags_str.split(",") if f.strip()]
        body_age = form.get("age")
        body_gender = form.get("gender")
        if body_age is not None:
            body_age = str(body_age) or None
        if body_gender is not None:
            body_gender = str(body_gender) or None
        image = form.get("image")  # may be UploadFile or None
        if image is not None and not hasattr(image, "content_type"):
            image = None
    else:
        # JSON body path (default; back-compat).
        try:
            raw = await request.json()
        except Exception:
            raise HTTPException(
                status_code=422,
                detail="Provide either JSON body or multipart form data with `symptoms`",
            )
        try:
            payload = TriageAnalyzeRequest.model_validate(raw)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        body_symptoms = payload.symptoms
        body_flags = payload.flags
        body_age = payload.age
        body_gender = payload.gender

    if not body_symptoms:
        raise HTTPException(
            status_code=422,
            detail="Provide either JSON body or multipart form data with `symptoms`",
        )

    # ---------- Optional image → vision cascade
    vision_signal_dict: dict | None = None
    if image is not None:
        # Validate image.
        if image.content_type not in settings.VISION_ALLOWED_MIME:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported image type: {image.content_type}. "
                       f"Allowed: {', '.join(settings.VISION_ALLOWED_MIME)}",
            )
        image_bytes = await image.read()
        if len(image_bytes) > settings.VISION_MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Image too large (max {settings.VISION_MAX_IMAGE_BYTES // (1024*1024)} MB)",
            )
        if len(image_bytes) == 0:
            raise HTTPException(status_code=422, detail="Empty image upload")

        from app.services.vision_service import analyze_image

        try:
            signal = await analyze_image(
                image_bytes=image_bytes,
                mime_type=image.content_type,
                symptoms_text=body_symptoms,
            )
            vision_signal_dict = signal.to_dict()
        except Exception as exc:
            # Vision pipeline must never break triage. Log and proceed
            # with text-only + an `uncertain` signal so the safety layer
            # does not silently treat missing vision as "non-serious".
            logger.warning("Vision pipeline failed: %s", exc)
            vision_signal_dict = {
                "visual_symptom_category": "unknown",
                "visual_urgency_signal": "uncertain",
                "confidence": 0,
                "model_version": "cascade.error",
                "source": "vision_llm_cascade",
            }

    from app.services.precision_service import apply_precision
    precision_data = await apply_precision(body_symptoms)
    
    triage_result = E.run_triage_v3(
        text=body_symptoms,
        flags=body_flags,
        vision_signal=vision_signal_dict,
    )
    triage_result.update(precision_data)
    return triage_result


# 2. POST /api/triage/emergency-route
@router.post("/triage/emergency-route", response_model=list[EmergencyHitOut])
async def triage_emergency_route(payload: EmergencyRouteRequest) -> list[dict]:
    return E.nearest_emergency(payload.cityId, payload.count or 4)


# 3. POST /api/cost/estimate
@router.post("/cost/estimate", response_model=CostEstimateOut)
async def cost_estimate(payload: CostEstimateRequest) -> dict:
    h = D.hospital_by_id(payload.hospitalId) or D.HOSPITALS[0]
    total = E.estimate_cost(payload.hospitalId, payload.diseaseId, payload.severity)
    stats = E.compute_finances(payload.financials.model_dump()) if payload.financials else None
    affordable = E.affordability_percent(total, stats) if stats else None
    from app.services.precision_service import apply_precision
    d_name = D.disease_by_id(payload.diseaseId).get("nameKey", payload.diseaseId)
    precision_data = await apply_precision(f"{d_name} surgery cost")

    return {
        "hospital": h,
        "total": total,
        "affordablePct": affordable,
        "monthly": round(total / 12),
        **precision_data
    }


# 4. POST /api/cost/alternatives
@router.post("/cost/alternatives", response_model=list[CostEstimateOut])
async def cost_alternatives(payload: CostAlternativesRequest) -> list[dict]:
    stats = E.compute_finances(payload.financials.model_dump()) if payload.financials else None
    return E.best_matches(payload.cityId, payload.diseaseId, payload.severity, stats, payload.pmjayOnly)


# 5. POST /api/insurance/analyze-policy
@router.post("/insurance/analyze-policy", response_model=CoverageReportOut)
async def insurance_analyze_policy(payload: AnalyzePolicyRequest) -> dict:
    from app.services.precision_service import apply_precision
    precision_data = await apply_precision("health insurance critical illness policy gaps India")
    
    result = E.analyse_policy(payload.coverage, payload.type, payload.networkIds)
    result.update(precision_data)
    return result


# 6. POST /api/schemes/match
@router.post("/schemes/match", response_model=list[SchemeMatchOut])
async def schemes_match(payload: SchemeMatchRequest) -> list[dict]:
    return E.match_schemes(payload.model_dump())


# 7. POST /api/facilities/search  (existing, unchanged)
@router.post("/facilities/search", response_model=list[FacilityHitOut])
async def facilities_search(payload: FacilitiesSearchRequest) -> list[dict]:
    return E.search_facilities(
        payload.cityId,
        payload.filters.model_dump(),
        payload.query,
        payload.sort,
    )


# 8. GET /api/asha/emergency-sync
@router.get("/asha/emergency-sync", response_model=list[EmergencyCaseOut])
async def asha_emergency_sync() -> list[dict]:
    """Mock list of recently triaged level-4 emergency patients in the local area."""
    return E.emergency_sync_cases()


# 9. V3: POST /api/facilities/advanced-search
# Rate-limited per IP (slowapi) because of the optional scrape+LLM path.
@router.post("/facilities/advanced-search", response_model=list[FacilityAdvancedOut])
@limiter.limit(settings.ADVANCED_SEARCH_RATE_LIMIT)
async def facilities_advanced_search(
    request: Request,  # required by slowapi
    payload: FacilitiesSearchRequest,
    disease_id: str | None = None,
    severity: str | None = None,
    include_pricing: bool = True,
    location_label: str | None = None,
) -> list[dict]:
    """V3 advanced facility search with curated-first pricing.

    Same filter semantics as `/facilities/search`. When `include_pricing`
    is true (default), each facility row carries a `price` block tagged
    with one of:
      - `verified_official_data`        (curated; confident)
      - `community_estimate_unverified` (scrape+LLM; clearly labeled)
      - `no_estimate_available`         (graceful miss)

    The frontend MUST visually distinguish verified vs. community
    estimates per V3 spec — see the `<PriceBadge>` component.
    """
    return await E.search_facilities_advanced_async(
        city_id=payload.cityId,
        filters=payload.filters.model_dump(),
        query=payload.query,
        disease_id=disease_id,
        severity=severity,
        include_pricing=include_pricing,
        price_location_label=location_label,
    )
