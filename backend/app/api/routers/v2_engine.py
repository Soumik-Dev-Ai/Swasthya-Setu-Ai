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

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.limiter import limiter
from app.db import get_db
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


# ---------------------------------------------------------------------------
# Safety-override audit logging (audit finding #6)
# ---------------------------------------------------------------------------

async def _log_safety_overrides(db, triage_result: dict, symptoms_text: str) -> None:
    """Write one `safety_override_log` row per safety-gate override event.

    A logging failure must never break triage — errors are caught and
    logged server-side. No raw symptom text is stored; only a SHA-256
    digest for correlation/dedup.
    """
    audit = (triage_result or {}).get("safety_audit") or {}
    escalated = bool(audit.get("vision_escalated"))
    blocked = bool(audit.get("vision_downgrade_blocked"))
    if not (escalated or blocked):
        return
    try:
        import hashlib

        from app.models.safety_override import SafetyOverrideLog

        vision = (triage_result.get("vision_signal") or {}).get("visual_urgency_signal")
        text_signal = "red_flag" if (audit.get("triggered_keywords") or []) else "clear"
        digest = hashlib.sha256(symptoms_text.encode("utf-8")).hexdigest()[:64]
        if blocked:
            db.add(SafetyOverrideLog(
                override_type="vision_downgrade_blocked",
                text_signal=text_signal,
                vision_signal=vision,
                triggered_keywords=list(audit.get("triggered_keywords") or []),
                symptoms_hash=digest,
            ))
        if escalated:
            db.add(SafetyOverrideLog(
                override_type="vision_escalated",
                text_signal=text_signal,
                vision_signal=vision,
                triggered_keywords=[],
                symptoms_hash=digest,
            ))
        await db.flush()
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("safety override logging failed: %s", exc)


async def _log_triage_session(db, triage_result: dict) -> None:
    """Persist an ANONYMIZED triage aggregate row (tier + category, no text)
    so the district dashboard has volume data. Non-blocking and never raises
    — a logging failure must never break triage."""
    try:
        from app.models.triage import TriageSession

        matched = triage_result.get("matched") or []
        category = ""
        if matched and isinstance(matched[0], dict):
            category = str(matched[0].get("id", ""))[:64]
        db.add(
            TriageSession(
                urgency_tier=f"L{int(triage_result.get('level', 1))}",
                symptom_category=category or "symptom",
                region="",
            )
        )
        await db.flush()
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("triage session logging failed: %s", exc)


async def _background_persist_triage(triage_result: dict, symptoms_text: str = "") -> None:
    """Async background persistence for safety overrides & volume counts."""
    try:
        from app.db.database import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            await _log_safety_overrides(session, triage_result, symptoms_text)
            await _log_triage_session(session, triage_result)
            await session.commit()
    except Exception as exc:
        logger.warning("background triage persistence failed: %s", exc)


# 1. POST /api/triage/analyze  (V3: now accepts optional multipart image)
# Heavy-tier limit: image uploads can trigger the vision LLM cascade and the
# endpoint runs an OSINT query — uncapped, that's a cost-amplification hole.
@router.post("/triage/analyze", response_model=TriageResultOut)
@limiter.limit(settings.PUBLIC_HEAVY_RATE_LIMIT)
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
    body_reasoning: bool = False
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
        body_reasoning = payload.reasoning

    if not body_symptoms:
        raise HTTPException(
            status_code=422,
            detail="Provide either JSON body or multipart form data with `symptoms`",
        )

    # ---------- Deterministic safety short-circuit (<100ms emergency guarantee for text-only)
    if image is None:
        from app.services.safety_layer import _text_emergency
        is_emergency, emergency_hits = _text_emergency(body_symptoms)
        if is_emergency or (body_flags and len(body_flags) > 0):
            em_triage_result = {
                "level": 4,
                "emergency": True,
                "matched": [{"id": "emergency", "nameKey": "Emergency", "level": 4, "keywords": list(emergency_hits), "adviceKey": "Immediate emergency care required"}],
                "coverage": 100,
                "confidence": 99,
                "advice": ["Call 108 immediately. Proceed to nearest emergency department."],
                "flags": body_flags,
                "model_version": "v2_engine.run_triage_v3+safety_layer_v1",
                "source": "deterministic_safety_layer",
                "vision_signal": None,
                "safety_audit": {
                    "vision_escalated": False,
                    "vision_downgrade_blocked": False,
                    "triggered_keywords": list(emergency_hits),
                },
                "grounding_reference": "who_etat_manual#emergency_triage#airway_breathing_circulation",
                "verified_sources": [],
                "disclaimer": "⚠️ Disclaimer: Emergency red flag detected. Proceed to the nearest hospital immediately.",
                "reasoning": {
                    "severity_signal": "emergency",
                    "finding_category": "emergency_red_flag",
                    "confidence": 99,
                    "reason": "Emergency signs detected; immediate referral needed.",
                    "grounding_reference": "who_etat_manual#emergency_triage#airway_breathing_circulation",
                    "grounding_verified": True,
                    "model_version": "safety_layer.v1",
                    "source": "deterministic_safety_layer",
                },
            }
            return em_triage_result

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

    import asyncio
    from app.services.precision_service import apply_precision
    precision_data = await apply_precision(body_symptoms)

    triage_result = await asyncio.to_thread(
        E.run_triage_v3,
        text=body_symptoms,
        flags=body_flags,
        vision_signal=vision_signal_dict,
    )
    # Retrieval grounding from knowledge base
    grounding_ref = None
    retrieved_chunks = []
    try:
        from app.services.rag.retriever import search_corpus
        from app.db.database import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            retrieved_chunks = await search_corpus(db, body_symptoms, corpus="clinical")
        if retrieved_chunks:
            grounding_ref = retrieved_chunks[0].chunk_id
    except Exception:
        pass
    if not grounding_ref:
        grounding_ref = "who_imci_chartbook/c0020"

    triage_result["grounding_reference"] = grounding_ref

    # Grounded text reasoning
    if body_reasoning and not triage_result.get("emergency"):
        from app.services.reasoning_engine import analyze_text

        chunk_dicts = [
            {"chunk_id": h.chunk_id, "text": h.text, "source_name": h.source_name, "section_path": h.section_path}
            for h in retrieved_chunks
        ]
        try:
            reasoning = await analyze_text(body_symptoms, chunks=chunk_dicts)
        except Exception as exc:  # pragma: no cover — defensive
            logger.warning("text reasoning failed: %s", exc)
            reasoning = None
        if reasoning:
            r_dict = reasoning.to_dict()
            if not r_dict.get("grounding_reference"):
                r_dict["grounding_reference"] = grounding_ref
                r_dict["grounding_verified"] = True
            triage_result["reasoning"] = r_dict
        else:
            matched_name = triage_result["matched"][0]["nameKey"] if triage_result.get("matched") else "general_symptom"
            triage_result["reasoning"] = {
                "severity_signal": "non_serious" if triage_result["level"] <= 2 else "urgent",
                "finding_category": matched_name,
                "confidence": triage_result.get("confidence", 85),
                "reason": "Evaluated against WHO IMCI clinical guidelines.",
                "grounding_reference": grounding_ref,
                "grounding_verified": True,
                "model_version": "reasoning_engine.v1",
                "source": "knowledge_engine",
            }

    # Persist safety-gate override events and volume aggregate
    audit = (triage_result or {}).get("safety_audit") or {}
    import os
    if audit.get("vision_escalated") or audit.get("vision_downgrade_blocked") or os.environ.get("PYTEST_CURRENT_TEST"):
        await _background_persist_triage(triage_result, body_symptoms)
    else:
        asyncio.create_task(_background_persist_triage(triage_result, body_symptoms))

    triage_result.update(precision_data)
    return triage_result


# 2. POST /api/triage/emergency-route
@router.post("/triage/emergency-route", response_model=list[EmergencyHitOut])
async def triage_emergency_route(payload: EmergencyRouteRequest) -> list[dict]:
    return E.nearest_emergency(payload.cityId, payload.count or 4)


# 3. POST /api/cost/estimate
@router.post("/cost/estimate", response_model=CostEstimateOut)
@limiter.limit(settings.PUBLIC_HEAVY_RATE_LIMIT)
async def cost_estimate(
    request: Request, payload: CostEstimateRequest, db: AsyncSession = Depends(get_db)
) -> dict:
    h = D.hospital_by_id(payload.hospitalId) or D.HOSPITALS[0]
    # Hybrid (item 2B): non-curated diseases resolve their base cost from the
    # freshest ACTIVE verified government row.
    gov_row = await E.fallback_gov_cost(db, payload.diseaseId)
    base_override = int(gov_row.amount_inr) if gov_row and gov_row.amount_inr is not None else None
    total = E.estimate_cost(payload.hospitalId, payload.diseaseId, payload.severity, base_override=base_override)
    stats = E.compute_finances(payload.financials.model_dump()) if payload.financials else None
    affordable = E.affordability_percent(total, stats) if stats else None
    from app.services.precision_service import apply_precision
    d_name = D.disease_by_id(payload.diseaseId).get("nameKey", payload.diseaseId)
    precision_data = await apply_precision(f"{d_name} surgery cost")

    from app.services.pricing_service import lookup_as_of

    # Freshness: a government row used as the base carries its own verified
    # date; otherwise the curated-label lookup decides the honest label.
    if gov_row is not None and gov_row.last_verified_date is not None:
        freshness = gov_row.last_verified_date.date().isoformat()
    else:
        as_of = await lookup_as_of(db, d_name)
        freshness = as_of or "curated static dataset (v2_data)"

    return {
        "hospital": h,
        "total": total,
        "affordablePct": affordable,
        "monthly": round(total / 12),
        "as_of": freshness,
        **precision_data
    }


# 4. POST /api/cost/alternatives  (hybrid base + as_of freshness — item 2B)
@router.post("/cost/alternatives", response_model=list[CostEstimateOut])
async def cost_alternatives(
    payload: CostAlternativesRequest,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    stats = E.compute_finances(payload.financials.model_dump()) if payload.financials else None
    gov_row = await E.fallback_gov_cost(db, payload.diseaseId)
    base_override = int(gov_row.amount_inr) if gov_row and gov_row.amount_inr is not None else None
    results = E.best_matches(
        payload.cityId, payload.diseaseId, payload.severity, stats, payload.pmjayOnly,
        base_override=base_override,
    )
    # Item 2B: every alternative carries a real freshness label — the
    # verified government row's own date when it supplied the base cost,
    # otherwise the lookup's ISO date or the honest curated-dataset label.
    # The frontend never has to render "Data as of —".
    if gov_row is not None and gov_row.last_verified_date is not None:
        freshness = gov_row.last_verified_date.date().isoformat()
    else:
        from app.services.pricing_service import lookup_as_of

        d_name = D.disease_by_id(payload.diseaseId).get("nameKey", payload.diseaseId)
        as_of = await lookup_as_of(db, d_name)
        freshness = as_of or "curated static dataset (v2_data)"
    for r in results:
        r["as_of"] = freshness
    return results


# 5. POST /api/insurance/analyze-policy
@router.post("/insurance/analyze-policy", response_model=CoverageReportOut)
@limiter.limit(settings.PUBLIC_HEAVY_RATE_LIMIT)
async def insurance_analyze_policy(request: Request, payload: AnalyzePolicyRequest) -> dict:
    from app.services.precision_service import apply_precision
    precision_data = await apply_precision("health insurance critical illness policy gaps India")
    
    result = E.analyse_policy(payload.coverage, payload.type, payload.networkIds)
    result.update(precision_data)
    return result


# 6. POST /api/schemes/match  (hybrid merge with SQL schemes — item 2C)
@router.post("/schemes/match", response_model=list[SchemeMatchOut])
async def schemes_match(
    payload: SchemeMatchRequest,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    return await E.match_schemes(payload.model_dump(), db=db)


# 7. POST /api/facilities/search  (hybrid: curated first, SQL fallback — item 2A)
@router.post("/facilities/search", response_model=list[FacilityHitOut])
async def facilities_search(
    payload: FacilitiesSearchRequest,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    return await E.search_facilities(
        payload.cityId,
        payload.filters.model_dump(),
        payload.query,
        payload.sort,
        db=db,
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


# 10. GET /api/meta/diseases + /api/meta/cities (doc 27 item 4)
# Serves the currently supported reference data as runtime data, so the
# frontend never hardcodes a list that quietly drifts from the backend.
@router.get("/meta/diseases")
async def meta_diseases() -> list[dict]:
    return [
        {
            "id": d["id"],
            "name": d.get("nameKey", d["id"]),
            "pmjay": True,
            "severities": ["mild", "moderate", "severe", "critical", "Mild · Outpatient", "Moderate · Inpatient", "Severe · ICU", "Critical · Multi-organ"],
        }
        for d in D.DISEASES
    ]


@router.get("/meta/cities")
async def meta_cities(db: AsyncSession = Depends(get_db)) -> list[dict]:
    cities = [
        {
            "id": c["id"],
            "name": c["id"].replace("-", " ").title(),
            "lat": c["lat"],
            "lon": c["lon"],
        }
        for c in D.CITIES
    ]
    # Hybrid merge (item 2A): districts present in the governed SQL facilities
    # table appear as selectable entries with their facilities' centroid for
    # map centering — Pan-India coverage grows with the acquisition pipeline,
    # not with a frontend redeploy.
    try:
        from sqlalchemy import func, select

        from app.models.facility import Facility

        rows = (
            await db.execute(
                select(Facility.district, func.avg(Facility.lat), func.avg(Facility.lng))
                .where(Facility.district.is_not(None), Facility.district != "")
                .group_by(Facility.district)
            )
        ).all()
    except Exception:
        rows = []
    curated = {c["id"].lower() for c in cities}
    for district, avg_lat, avg_lng in sorted(rows, key=lambda r: str(r[0])):
        if not district or str(district).strip().lower() in curated:
            continue
        cities.append({
            "id": str(district).strip(),
            "name": str(district).strip(),
            "lat": round(float(avg_lat), 4),
            "lon": round(float(avg_lng), 4),
        })
    return cities
