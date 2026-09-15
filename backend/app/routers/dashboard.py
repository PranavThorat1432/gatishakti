"""
Dashboard summary (continuation-prompt section 8 / 12).

Deliberately simple, deterministic counts over the same collections every
other endpoint reads -- no separate materialized view, no invented metrics.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from app.db import congestion_collection, defects_collection, events_collection, fleet_collection

router = APIRouter(tags=["dashboard"])

# A congestion observation counts toward a "hotspot" above this score.
# Simple fixed cutoff, documented here rather than buried -- not a calibrated
# traffic-engineering threshold, just a readable prototype default.
CONGESTION_HOTSPOT_THRESHOLD = 0.6


class DashboardSummary(BaseModel):
    active_buses: int
    events_today: int
    confirmed_defects: int
    unconfirmed_defects: int
    congestion_hotspots: int
    generated_at: datetime


@router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary() -> DashboardSummary:
    now = datetime.now(timezone.utc)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)

    active_buses = fleet_collection.count_documents({"status": "active"})
    events_today = events_collection.count_documents({"created_at": {"$gte": start_of_day}})
    confirmed_defects = defects_collection.count_documents({"status": "confirmed"})
    unconfirmed_defects = defects_collection.count_documents({"status": "unconfirmed"})
    congestion_hotspots = congestion_collection.count_documents(
        {
            "congestion_score": {"$gte": CONGESTION_HOTSPOT_THRESHOLD},
            "created_at": {"$gte": now - timedelta(hours=1)},
        }
    )

    return DashboardSummary(
        active_buses=active_buses,
        events_today=events_today,
        confirmed_defects=confirmed_defects,
        unconfirmed_defects=unconfirmed_defects,
        congestion_hotspots=congestion_hotspots,
        generated_at=now,
    )
