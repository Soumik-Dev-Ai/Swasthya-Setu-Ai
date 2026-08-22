"""Seed script — populate database with dummy data.

Run:
    python -m scripts.seed_data
or  python scripts/seed_data.py
"""
import asyncio
import sys
from pathlib import Path

# Ensure the backend root is importable when run as a plain script.
THIS_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = THIS_DIR.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import select  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.database import AsyncSessionLocal, Base, engine  # noqa: E402
from app.models.asha import AshaRecord  # noqa: F401, E402
from app.models.facility import Facility  # noqa: E402
from app.models.pricing import Pricing  # noqa: F401, E402
from app.models.scheme import Scheme  # noqa: E402
from app.models.triage import TriageSession  # noqa: F401, E402
from app.models.user import Role, User  # noqa: E402


async def _create_admin(db) -> User:
    existing = await db.scalar(select(User).where(User.username == settings.DEFAULT_ADMIN_USERNAME))
    if existing:
        return existing
    admin = User(
        username=settings.DEFAULT_ADMIN_USERNAME,
        hashed_password=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
        role=Role.ADMIN,
    )
    db.add(admin)
    await db.flush()
    return admin


async def _create_asha(db) -> User:
    existing = await db.scalar(select(User).where(User.username == settings.DEFAULT_ASHA_USERNAME))
    if existing:
        return existing
    asha = User(
        username=settings.DEFAULT_ASHA_USERNAME,
        hashed_password=hash_password(settings.DEFAULT_ASHA_PASSWORD),
        role=Role.ASHA,
    )
    db.add(asha)
    await db.flush()
    return asha


async def _create_schemes(db) -> list[Scheme]:
    names = ["PM-JAY", "PMBJP"]
    schemes: list[Scheme] = []
    for name in names:
        existing = await db.scalar(select(Scheme).where(Scheme.name == name))
        if existing:
            schemes.append(existing)
            continue
        scheme = Scheme(
            name=name,
            coverage_rules="Up to 5 lakh INR per family per year (PM-JAYMock)" if name == "PM-JAY" else "Capped subsidy on generic drugs (PMBJPmock)",
            eligibility_notes="Low-income families per SECC 2011mock" if name == "PM-JAY" else "All citizens eligiblemock",
        )
        db.add(scheme)
        await db.flush()
        schemes.append(scheme)
    return schemes


async def _create_facilities(db) -> list[Facility]:
    facilities_data = [
        {
            "name": "Rampur Sub-Centre",
            "type": "SC",
            "pm_jay_empaneled": False,
            "lat": 28.80,
            "lng": 79.10,
            "district": "Rampur",
            "state": "Uttar Pradesh",
        },
        {
            "name": "Bhopal PHC",
            "type": "PHC",
            "pm_jay_empaneled": True,
            "lat": 23.25,
            "lng": 77.41,
            "district": "Bhopal",
            "state": "Madhya Pradesh",
        },
        {
            "name": "Ratlam CHC",
            "type": "CHC",
            "pm_jay_empaneled": True,
            "lat": 23.33,
            "lng": 74.79,
            "district": "Ratlam",
            "state": "Madhya Pradesh",
        },
        {
            "name": "AIIMS Delhi PM-JAY Hospital",
            "type": "PM-JAY_Hospital",
            "pm_jay_empaneled": True,
            "lat": 28.56,
            "lng": 77.21,
            "district": "New Delhi",
            "state": "Delhi",
        },
        {
            "name": "Jan Aushadhi PMBJP Pharmacy",
            "type": "PMBJP_Pharmacy",
            "pm_jay_empaneled": False,
            "lat": 26.91,
            "lng": 75.78,
            "district": "Jaipur",
            "state": "Rajasthan",
        },
    ]
    facilities: list[Facility] = []
    for data in facilities_data:
        existing = await db.scalar(select(Facility).where(Facility.name == data["name"]))
        if existing:
            facilities.append(existing)
            continue
        fac = Facility(**data)
        db.add(fac)
        await db.flush()
        facilities.append(fac)
    return facilities


async def _create_pricing(db, facilities: list[Facility], schemes: list[Scheme]) -> None:
    pm_jay_scheme = schemes[0]
    pmbjp_scheme = schemes[1]
    pm_jay_hospital = next(f for f in facilities if f.type == "PM-JAY_Hospital")
    chc = next(f for f in facilities if f.type == "CHC")
    phc = next(f for f in facilities if f.type == "PHC")
    pharmacy = next(f for f in facilities if f.type == "PMBJP_Pharmacy")

    pricing_rows = [
        {"facility": pm_jay_hospital, "scheme": pm_jay_scheme, "category": "cardiac_surgery", "base": 150000.0, "subsidized": 50000.0},
        {"facility": pm_jay_hospital, "scheme": pm_jay_scheme, "category": "oncology_consultation", "base": 3000.0, "subsidized": 0.0},
        {"facility": chc, "scheme": pm_jay_scheme, "category": "maternal_delivery", "base": 8000.0, "subsidized": 5000.0},
        {"facility": phc, "scheme": None, "category": "general_consultation", "base": 200.0, "subsidized": 0.0},
        {"facility": pharmacy, "scheme": pmbjp_scheme, "category": "generic_drugs_monthly", "base": 1200.0, "subsidized": 800.0},
    ]
    for row in pricing_rows:
        existing = await db.scalar(
            select(Pricing)
            .where(Pricing.facility_id == row["facility"].id)
            .where(Pricing.procedure_category == row["category"])
        )
        if existing:
            continue
        db.add(
            Pricing(
                facility_id=row["facility"].id,
                scheme_id=row["scheme"].id if row["scheme"] else None,
                procedure_category=row["category"],
                base_cost=row["base"],
                subsidized_cost=row["subsidized"],
            )
        )
    await db.flush()


async def seed() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        admin = await _create_admin(db)
        asha = await _create_asha(db)
        schemes = await _create_schemes(db)
        facilities = await _create_facilities(db)
        await _create_pricing(db, facilities, schemes)

        # Seed one AshaRecord so GET /api/asha/records returns data immediately.
        if not (await db.scalar(select(AshaRecord.id).where(AshaRecord.worker_id == asha.id).limit(1))):
            db.add(
                AshaRecord(
                    worker_id=asha.id,
                    record_type="household_survey",
                    structured_fields={
                        "household_id": "H-001",
                        "members": 5,
                        "income_bracket": "BPL",
                        "village": "Rampur Khas",
                    },
                    device_local_id="seed-1",
                )
            )

        await db.commit()
        await db.close()

    print("Seed complete:")
    print(f"  admin user: {admin.username} (id={admin.id})")
    print(f"  asha  user: {asha.username} (id={asha.id})")
    print(f"  schemes:    {[s.name for s in schemes]}")
    print(f"  facilities: {len(facilities)} rows")


if __name__ == "__main__":
    asyncio.run(seed())
