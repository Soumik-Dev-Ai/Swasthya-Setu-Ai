"""V2 engine — faithful port of frontend/src/lib/engine.ts.

Pure deterministic business logic. The v2 router calls these functions and
returns JSON shaped identically to what the frontend's old in-memory engine
produced, so components only need to flip from sync to async.
"""
from __future__ import annotations

import re
import unicodedata

from app.services import v2_data as D


# ------------------------------------------------------------------ tokenize

# Allow Devanagari (U+0900–097F) and Bengali (U+0980–09FF) like the TS version.
_TOKEN_RE = re.compile(r"[^a-z0-9\u0900-\u097f\u0980-\u09ff\s-]", re.UNICODE)


def tokenize(text: str) -> list[str]:
    nfkd = unicodedata.normalize("NFKD", text.lower())
    # strip combining diacritics
    stripped = "".join(ch for ch in nfkd if not unicodedata.combining(ch))
    cleaned = _TOKEN_RE.sub(" ", stripped)
    return [t for t in cleaned.split() if len(t) > 1]


# ------------------------------------------------------------------ triage

def run_triage(text: str, flags: list[str]) -> dict:
    tokens = tokenize(text)
    scored: list[tuple[dict, int]] = []
    for c in D.CONDITIONS:
        hits = 0
        for k in c["keywords"]:
            kw = k.lower()
            if any(t.startswith(kw) or kw.startswith(t) or kw in t for t in tokens):
                hits += 1
        if hits > 0:
            scored.append((c, hits))

    scored.sort(key=lambda x: x[1], reverse=True)

    top = [c for c, _ in scored[:3]]
    total_hits = sum(h for _, h in scored)
    coverage = (
        min(100, round((total_hits / max(4, len(tokens))) * 130)) if tokens else 0
    )
    emergency = len(flags) > 0
    peak_level = max((c["level"] for c in top), default=1)
    level = 4 if emergency else peak_level
    if emergency:
        confidence = 98
    elif top:
        confidence = min(
            96,
            42 + scored[0][1] * 9 + (8 if len(top) > 1 else 0) + min(14, coverage / 4),
        )
    else:
        confidence = 30

    advice = [
        f"{D.LEVEL_NAMES[c['level']]} · {c['adviceKey']}" for c in top[:2]
    ]

    return {
        "level": level,
        "emergency": emergency,
        "matched": [_condition_public(c) for c in top],
        "coverage": min(100, coverage + (8 if top else 0)),
        "confidence": round(confidence),
        "advice": advice,
        "flags": list(flags),
    }


def _condition_public(c: dict) -> dict:
    return {
        "id": c["id"],
        "nameKey": c["nameKey"],
        "level": c["level"],
        "keywords": list(c["keywords"]),
        "adviceKey": c["adviceKey"],
    }


# ------------------------------------------------------------------ finances

def compute_finances(f: dict) -> dict:
    income = max(0, f.get("income") or 0)
    fixed = sum(max(0, f.get(k) or 0) for k in
               ("housing", "food", "transport", "school", "emi", "insurancePrem", "other"))
    disposable = max(0, income - fixed)
    savings = max(0, disposable)
    savings_rate = round((savings / income) * 100) if income > 0 else 0
    return {"savingsRate": savings_rate, "disposable": disposable, "savings": savings}


def monthly_capacity(stats: dict) -> int:
    return round(stats["disposable"] * 0.28)


def affordability_percent(total: float, stats: dict) -> int:
    cap = monthly_capacity(stats)
    monthly = max(1, total / 12)
    pct = round((cap / monthly) * 100)
    return max(0, min(100, pct))


# ------------------------------------------------------------------ cost

def estimate_cost(hospital_id: str, disease_id: str, severity: str) -> int:
    d = D.disease_by_id(disease_id)
    h = D.hospital_by_id(hospital_id) or D.HOSPITALS[0]
    city = D.city_by_id(h["cityId"])
    sev_idx = max(d["minSeverity"], D.SEVERITY_INDEX[severity])
    return round(d["base"][sev_idx] * h["priceIndex"] * city["priceIndex"])


def cost_benchmark(city_id: str, disease_id: str, severity: str) -> dict:
    hs = [h for h in D.HOSPITALS if h["cityId"] == city_id]
    costs = sorted(estimate_cost(h["id"], disease_id, severity) for h in hs)
    median = costs[len(costs) // 2] if costs else 0
    return {"min": costs[0] if costs else 0, "max": costs[-1] if costs else 0, "median": median}


def best_matches(city_id: str, disease_id: str, severity: str, stats: dict | None, pmjay_only: bool) -> list[dict]:
    hs = [h for h in D.HOSPITALS if h["cityId"] == city_id and (not pmjay_only or h["pmjay"])]
    rated = []
    for h in hs:
        total = estimate_cost(h["id"], disease_id, severity)
        affordable_pct = affordability_percent(total, stats) if stats else None
        aff_score = affordable_pct if stats is not None else 70
        combined = h["score"] * 0.55 + aff_score * 0.45
        rated.append({
            "hospital": h,
            "total": total,
            "affordablePct": affordable_pct,
            "monthly": round(total / 12),
            "combined": combined,
        })
    rated.sort(key=lambda r: r["combined"], reverse=True)
    # Return the full ranked list so the frontend can both display the top 3
    # (bestMatches) and compute min/max/median (costBenchmark) from one call.
    return [
        {
            "hospital": r["hospital"],
            "total": r["total"],
            "affordablePct": r["affordablePct"],
            "monthly": r["monthly"],
        }
        for r in rated
    ]


def nearest_emergency(city_id: str, count: int = 4) -> list[dict]:
    city = D.city_by_id(city_id)
    out = []
    for h in D.HOSPITALS:
        if not h["er24"]:
            continue
        km = D.haversine(city["lat"], city["lon"], h["lat"], h["lon"])
        out.append({"hospital": h, "km": km})
    out.sort(key=lambda r: r["km"])
    return out[:count]


# ------------------------------------------------------------------ insurance

def analyse_policy(coverage: int, policy_type: str, network_ids: list[str]) -> dict:
    gaps: list[dict] = []
    claims: list[dict] = []
    actions: list[str] = []

    if coverage < 300000:
        gaps.append({"severity": "critical", "text": "Sum insured below ₹3 lakh. One ICU episode (₹1.1 – 2.2 lakh in metro ICUs) can exhaust 60–75% of the cover in a single admission."})
        actions.append("Raise sum insured to at least ₹5 lakh — a top-up policy is the cheapest way to bridge this gap.")
    elif coverage < 500000:
        gaps.append({"severity": "warn", "text": "₹3–5 lakh cover is tight for critical illness. Cardiac surgery or stroke care commonly bills ₹2.6 – 5.2 lakh at NABH hospitals."})
        actions.append("Consider a ₹10 lakh super top-up with a ₹3 lakh deductible.")
    else:
        gaps.append({"severity": "info", "text": "Sum insured is at the healthy benchmark for family-size medical episodes."})

    if policy_type == "fam":
        claims.append({"severity": "warn", "text": "Family floaters share one limit: two simultaneous hospitalisations consume the pool together. A newborn can be added only after 90 days in most policies."})
    else:
        claims.append({"severity": "info", "text": "Individual policies are not portable across family members — each member needs a separate cover or a top-up."})

    claims.append({"severity": "critical", "text": "Bed-category rule: rooms above the policy's eligible class (usually 'single non-AC') attract a 10–25% proportionate deduction on the entire bill, not just the room rent."})
    claims.append({"severity": "warn", "text": "Pre-existing diseases get covered only after the waiting period (typically 3–4 years). Day-care procedures have a 1–2 year cap."})
    claims.append({"severity": "warn", "text": "Cashless claims must be pre-authorised within 24 hours of admission for emergencies and 48 hours before for planned procedures."})
    claims.append({"severity": "info", "text": "Consumables (gloves, syringes, oxygen masks) can be 8–15% of the bill and are commonly capped or excluded in basic plans."})
    claims.append({"severity": "warn", "text": "Home-care post-discharge claims are paid only if medically prescribed for conditions listed in the policy's post-hospitalisation clause."})

    if len(network_ids) < 10:
        gaps.append({"severity": "warn", "text": "Network is narrow in this region — nearest empanelled hospital may be outside your city for advanced procedures."})

    risk_score = min(
        96,
        round(
            (46 if coverage < 300000 else 30 if coverage < 500000 else 12)
            + (10 if policy_type == "fam" else 4)
            + (18 if len(network_ids) < 10 else 6)
        ),
    )
    risk = "high" if risk_score > 60 else "med" if risk_score > 32 else "low"

    return {
        "risk": risk,
        "riskScore": risk_score,
        "gaps": gaps,
        "claims": claims,
        "actions": actions,
        "inNetworkCount": len(network_ids),
    }


# ------------------------------------------------------------------ schemes

def match_schemes(profile: dict) -> list[dict]:
    out = []
    for s in D.SCHEMES:
        pct = s["match"](profile)
        out.append({"scheme": _scheme_public(s), "pct": pct})

    filtered = []
    for r in out:
        s = r["scheme"]
        # Mirror TS logic: schemes with require="need" are hidden unless need != general
        if s.get("require") is None:
            keep = r["pct"] >= 30
        elif s["require"] == "need":
            keep = profile.get("need") != "need.general" and r["pct"] >= 30
        else:
            keep = r["pct"] >= 30
        if keep:
            filtered.append(r)
    filtered.sort(key=lambda r: r["pct"], reverse=True)
    return filtered


def _scheme_public(s: dict) -> dict:
    return {
        "id": s["id"],
        "name": s["name"],
        "short": s["short"],
        "type": s["type"],
        "benefit": s["benefit"],
        "docs": s["docs"],
    }


# ------------------------------------------------------------------ facilities

def search_facilities(
    city_id: str,
    filters: dict,
    query: str,
    sort: str,
) -> list[dict]:
    city = D.city_by_id(city_id)
    rows = []
    q = query.strip().lower()
    for h in D.HOSPITALS:
        if h["cityId"] != city_id:
            continue
        if filters.get("pmjay") and not h["pmjay"]:
            continue
        if filters.get("er24") and not h["er24"]:
            continue
        if filters.get("icu") and not h["icu"]:
            continue
        if filters.get("blood") and not h["bloodBank"]:
            continue
        if filters.get("nabh") and not h["nabh"]:
            continue
        if filters.get("beds") and h["beds"] < 50:
            continue
        if q and q not in h["name"].lower():
            continue
        km = D.haversine(city["lat"], city["lon"], h["lat"], h["lon"])
        rows.append({"hospital": h, "km": km})

    if sort == "cost":
        rows.sort(key=lambda r: r["hospital"]["priceIndex"])
    elif sort == "quality":
        rows.sort(key=lambda r: r["hospital"]["score"], reverse=True)
    else:
        rows.sort(key=lambda r: r["km"])
    return rows


# ------------------------------------------------------------------ emergency sync

def emergency_sync_cases() -> list[dict]:
    """Mock list of recently triaged level-4 emergency patients."""
    now_ms = 1724150000000  # deterministic timestamp anchor
    return [
        {
            "id": "c-sync-1",
            "name": "Ramesh Kumar",
            "age": "54",
            "sex": "m",
            "cityId": "delhi",
            "symptoms": "chest pain, sweating, pain spreading to left arm",
            "conditions": ["cardiac"],
            "level": 4,
            "assessedAt": now_ms - 1000 * 60 * 4,
            "status": "pending",
        },
        {
            "id": "c-sync-2",
            "name": "Sunita Devi",
            "age": "28",
            "sex": "f",
            "cityId": "bhopal",
            "symptoms": "pregnancy with bleeding, third trimester",
            "conditions": ["dengue-sev"],
            "level": 4,
            "assessedAt": now_ms - 1000 * 60 * 12,
            "status": "pending",
        },
        {
            "id": "c-sync-3",
            "name": "Md. Irfan",
            "age": "6",
            "sex": "m",
            "cityId": "kolkata",
            "symptoms": "rapid breathing, grunting, chest indrawing",
            "conditions": ["pneumonia"],
            "level": 4,
            "assessedAt": now_ms - 1000 * 60 * 22,
            "status": "pending",
        },
    ]


# ------------------------------------------------------------------ V3 deep integration


def run_triage_v3(
    text: str,
    flags: list[str],
    vision_signal: dict | None = None,
) -> dict:
    """Vision-augmented triage that ALWAYS passes through the safety layer.

    Contract (V3 spec):
    - Pure computation; no I/O.
    - The deterministic safety layer is the final authority on urgency.
      Vision model output is a *signal*, never a verdict.
    - Returns the same shape as `run_triage` plus V3 provenance fields:
      `model_version`, `source`, `vision_signal`, `safety_audit`.
    """
    # Step 1: text pathway.
    text_result = run_triage(text, flags)
    text_level = text_result["level"]

    # Step 2: safety layer — the deterministic final authority.
    from .safety_layer import enforce_red_flag_safety

    visual_urgency = vision_signal.get("visual_urgency_signal") if vision_signal else None
    verdict = enforce_red_flag_safety(
        symptoms_text=text,
        frontend_flags=flags,
        text_level=text_level,
        visual_urgency_signal=visual_urgency,
    )

    # Step 3: rebuild a vision-aware matched list. If the vision model
    # picked a category the text pathway missed (e.g. a rash the user
    # didn't describe in words), append it so the UI can surface it.
    matched = list(text_result.get("matched", []))
    seen_ids = {m["id"] for m in matched if isinstance(m, dict) and "id" in m}
    if vision_signal and vision_signal.get("visual_symptom_category"):
        cat = vision_signal["visual_symptom_category"]
        if cat and cat not in seen_ids and cat != "unknown":
            for c in D.CONDITIONS:
                if c["id"] == cat:
                    matched.insert(0, _condition_public(c))
                    break

    # Vision escalated a non-emergency text case — surface to user.
    advice = list(text_result.get("advice", []))
    if verdict.vision_escalated and not advice:
        advice = [
            "Based on the photo, we've raised the urgency of this assessment.",
        ]
    elif verdict.vision_escalated:
        advice.insert(
            0,
            "Based on the photo, we've raised the urgency of this assessment.",
        )

    # Confidence: blend text-pathway and vision confidence if both present.
    confidence = int(text_result.get("confidence", 0))
    if vision_signal and isinstance(vision_signal.get("confidence"), (int, float)):
        confidence = max(0, min(100, round((confidence + vision_signal["confidence"]) / 2)))

    return {
        "level": verdict.level,
        "emergency": verdict.emergency,
        "matched": matched,
        "coverage": int(text_result.get("coverage", 0)),
        "confidence": confidence,
        "advice": advice,
        "flags": list(flags),
        "model_version": "v2_engine.run_triage_v3+safety_layer_v1",
        "source": "deterministic_safety_layer",
        "vision_signal": vision_signal,
        "safety_audit": {
            "vision_escalated": verdict.vision_escalated,
            "vision_downgrade_blocked": verdict.vision_downgrade_blocked,
            "triggered_keywords": list(verdict.triggered_keywords),
        },
    }


def search_facilities_advanced(
    city_id: str,
    filters: dict,
    query: str,
    disease_id: str | None,
    severity: str | None,
    include_pricing: bool = True,
    price_location_label: str | None = None,
) -> list[dict]:
    """V3 deep integration: same search as `search_facilities` but with
    per-hospital pricing. Curated pricing is checked first; the
    scrape+LLM cascade is only consulted when no curated match exists
    AND `include_pricing=True`.

    Returns a list of dicts shaped like:
        {
          "hospital": {...},     # full hospital dict
          "km": int,
          "price": { source, amount_inr, confidence, notes, model_version },
          "source": str,         # convenience duplicate of price.source
        }

    Failures of the price pipeline are surfaced as
    `source="no_estimate_available"` on the individual record — the
    facility list is still returned (graceful degradation).
    """
    # Reuse the existing search to keep filter semantics identical.
    base_results = search_facilities(city_id, filters, query, "near")
    if not include_pricing:
        for r in base_results:
            r["price"] = None
            r["source"] = "verified_official_data"
        return base_results

    return _augment_with_pricing_sync(
        base_results=base_results,
        disease_id=disease_id,
        severity=severity,
        query=query,
        location_label=price_location_label,
        city_id=city_id,
    )


def _augment_with_pricing_sync(
    *,
    base_results: list[dict],
    disease_id: str | None,
    severity: str | None,
    query: str,
    location_label: str | None,
    city_id: str,
) -> list[dict]:
    """Synchronous wrapper that runs the async pricing gather.

    Used by the search engine entry point so it can be called from
    both sync and async contexts without duplicating logic.
    """
    import asyncio

    async def _price_for(hospital: dict) -> dict:
        from .pricing_service import get_price_estimate, NO_ESTIMATE
        loc_label = location_label or hospital.get("cityId") or city_id
        estimate = await get_price_estimate(
            disease_id=disease_id,
            severity=severity,
            query=query or None,
            location=loc_label,
        )
        if estimate.source == NO_ESTIMATE:
            return {
                "source": NO_ESTIMATE,
                "amount_inr": None,
                "confidence": 0,
                "notes": estimate.notes,
                "model_version": estimate.model_version,
            }
        return estimate.to_dict()

    async def _augment() -> list[dict]:
        tasks = [_price_for(r["hospital"]) for r in base_results]
        prices = await asyncio.gather(*tasks, return_exceptions=True)
        out: list[dict] = []
        for r, p in zip(base_results, prices):
            if isinstance(p, Exception):
                p = {
                    "source": "no_estimate_available",
                    "amount_inr": None,
                    "confidence": 0,
                    "notes": f"price lookup failed: {p}",
                    "model_version": "error",
                }
            r["price"] = p
            r["source"] = p.get("source", "no_estimate_available")
            out.append(r)
        return out

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(_augment())
    raise RuntimeError(
        "search_facilities_advanced must be awaited from an async caller; "
        "router already does this — see v2_engine.router.facilities_advanced_search"
    )


async def search_facilities_advanced_async(
    city_id: str,
    filters: dict,
    query: str,
    disease_id: str | None,
    severity: str | None,
    include_pricing: bool = True,
    price_location_label: str | None = None,
) -> list[dict]:
    """Async entry point used by the FastAPI router."""
    base_results = search_facilities(city_id, filters, query, "near")
    if not include_pricing:
        for r in base_results:
            r["price"] = None
            r["source"] = "verified_official_data"
        return base_results

    import asyncio as _aio
    from .pricing_service import get_price_estimate, NO_ESTIMATE

    async def _price_for(hospital: dict) -> dict:
        loc_label = price_location_label or hospital.get("cityId") or city_id
        estimate = await get_price_estimate(
            disease_id=disease_id,
            severity=severity,
            query=query or None,
            location=loc_label,
        )
        if estimate.source == NO_ESTIMATE:
            return {
                "source": NO_ESTIMATE,
                "amount_inr": None,
                "confidence": 0,
                "notes": estimate.notes,
                "model_version": estimate.model_version,
            }
        return estimate.to_dict()

    tasks = [_price_for(r["hospital"]) for r in base_results]
    prices = await _aio.gather(*tasks, return_exceptions=True)
    out: list[dict] = []
    for r, p in zip(base_results, prices):
        if isinstance(p, Exception):
            p = {
                "source": "no_estimate_available",
                "amount_inr": None,
                "confidence": 0,
                "notes": f"price lookup failed: {p}",
                "model_version": "error",
            }
        r["price"] = p
        r["source"] = p.get("source", "no_estimate_available")
        out.append(r)
    return out

