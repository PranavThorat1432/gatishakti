from fastapi import APIRouter

from app.db import fleet_collection
from app.models.schemas import BusStatus

router = APIRouter(tags=["fleet"])


def _list_buses() -> list[BusStatus]:
    docs = list(fleet_collection.find({}))
    return [
        BusStatus(
            bus_id=d["bus_id"],
            route_id=d.get("route_id"),
            location=d["location"],
            last_seen_at=d["last_seen_at"],
            status=d.get("status", "active"),
        )
        for d in docs
    ]


@router.get("/buses", response_model=list[BusStatus])
def list_buses():
    return _list_buses()


@router.get("/fleet", response_model=list[BusStatus], include_in_schema=False)
def list_fleet():
    """Deprecated alias for /buses, kept so nothing that already calls it breaks."""
    return _list_buses()
