"""
Optional urban-insight generation (continuation-prompt section 15).

Strictly a summarizer over the dashboard's own aggregate numbers -- never a
detector, never required for the dashboard to function. If OpenRouter is
unconfigured or fails, this returns a clear "unavailable" message with a 200,
not an error -- a failed optional feature must never look like a broken app.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.routers.dashboard import dashboard_summary
from app.services import openrouter_service

router = APIRouter(tags=["insights"])


class InsightResponse(BaseModel):
    available: bool
    insight: str


@router.post("/insights", response_model=InsightResponse)
async def generate_insight() -> InsightResponse:
    summary = dashboard_summary()
    text = await openrouter_service.generate_insight(summary.model_dump(mode="json"))
    return InsightResponse(available=openrouter_service.is_available(), insight=text)
