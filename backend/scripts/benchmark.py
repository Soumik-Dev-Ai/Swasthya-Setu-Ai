"""Performance benchmark for the measurable NFRs (doc 02 §5).

- safety-gate response < 200ms
- deterministic triage (no LLM) latency
- dashboard cache-hit < 200ms

The "<3s full triage p95 online" NFR is a live-provider latency and is NOT
measured here (no live cascade in a benchmark run). This script reports
observable, reproducible numbers only.
"""
import asyncio
import sys
import time

sys.path.insert(0, ".")

from app.core.config import settings

N = 2000


def bench_safety_gate() -> None:
    from app.services.safety_layer import enforce_red_flag_safety

    enforce_red_flag_safety(
        symptoms_text="chest pain radiating", frontend_flags=[], text_level=1, visual_urgency_signal=None
    )  # warm (no state, just import)
    t0 = time.perf_counter()
    for _ in range(N):
        enforce_red_flag_safety(
            symptoms_text="chest pain radiating",
            frontend_flags=[],
            text_level=1,
            visual_urgency_signal="non_serious",
        )
    dt = (time.perf_counter() - t0) / N * 1000
    print(f"safety gate:            {dt:.4f} ms/call   (NFR <200ms: {'PASS' if dt < 200 else 'FAIL'})")


def bench_deterministic_triage() -> None:
    from app.services import v2_engine as E

    t0 = time.perf_counter()
    for _ in range(N):
        E.run_triage_v3(text="fever and cough since morning", flags=[], vision_signal=None)
    dt = (time.perf_counter() - t0) / N * 1000
    print(f"deterministic triage:   {dt:.4f} ms/call")


async def bench_dashboard_cache_hit() -> None:
    from app.db.database import AsyncSessionLocal
    from app.services import dashboard_service

    async with AsyncSessionLocal() as db:
        await dashboard_service.district_aggregates(db)  # cold (fills cache)
        t0 = time.perf_counter()
        for _ in range(50):
            await dashboard_service.district_aggregates(db)
        dt = (time.perf_counter() - t0) / 50 * 1000
        dashboard_service._dashboard_cache.clear()
    print(f"dashboard cache-hit:    {dt:.4f} ms/call   (NFR <200ms: {'PASS' if dt < 200 else 'FAIL'})")


def main() -> None:
    print(f"EMBEDDING_MODEL={settings.EMBEDDING_MODEL} (benchmark is model-independent)")
    bench_safety_gate()
    bench_deterministic_triage()
    asyncio.run(bench_dashboard_cache_hit())


if __name__ == "__main__":
    main()