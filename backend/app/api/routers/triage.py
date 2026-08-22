"""Triage router."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.schemas.triage import TriageAnalyzeRequest, TriageResult
from app.services.triage_service import analyze_triage

router = APIRouter()


@router.post("/analyze", response_model=TriageResult)
async def analyze(
    payload: TriageAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
) -> TriageResult:
    result = await analyze_triage(db, payload.symptoms, payload.location.model_dump())
    return TriageResult(**result)
