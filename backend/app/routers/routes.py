"""
Route Intelligence API (P0-05).

All three endpoints are read-only additive additions; nothing existing
changes. Route association is by route_id (P0-06 MVP rule): observations,
congestion and buses filter on their stored route_id, and defects inherit
the route_id of the observation that created them. Legacy documents without
a route_id are treated as route-unassigned and excluded from route counts,
never a crash.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import congestion_collection, defects_collection, events_collection, fleet_collection
from app.services.routes_seed import get_route

router = APIRouter(tags=["routes"])

# Same readable cutoff the dashboard uses -- documented, not calibrated.
CONGESTION_HOTSPOT_THRESHOLD = 0.6


class RouteOriginDest(BaseModel):
    name: str
    latitude: float
    longitude: float


class RouteOut(BaseModel):
    route_id: str
    route_name: str
    origin: RouteOriginDest
    destination: RouteOriginDest
    geometry: dict
    active: bool
    # Additive metadata from the road-network computation (osrm-osm).
    distance_km: float | None = None
    duration_min: int | None = None
    geometry_source: str | None = None


class RouteSummary(BaseModel):
    route_id: str
    route_name: str
    buses_recorded: int
    observation_count: int
    defect_count: int
    confirmed_defect_count: int
    unconfirmed_defect_count: int
    congestion_hotspot_count: int
    source: str


def _to_route_out(doc: dict) -> RouteOut:
    return RouteOut(
        route_id=doc["route_id"],
        route_name=doc["route_name"],
        origin=RouteOriginDest(**doc["origin"]),
        destination=RouteOriginDest(**doc["destination"]),
        geometry=doc["geometry"],
        active=doc.get("active", True),
        distance_km=doc.get("distance_km"),
        duration_min=doc.get("duration_min"),
        geometry_source=doc.get("geometry_source"),
    )


@router.get("/routes", response_model=list[RouteOut])
def list_routes():
    docs = list(routes_collection_find_all())
    return [_to_route_out(d) for d in docs]


def routes_collection_find_all():
    from app.db import routes_collection

    return routes_collection.find({}).sort("route_id", 1)


@router.get("/routes/{route_id}", response_model=RouteOut)
def get_single_route(route_id: str):
    doc = get_route(route_id)
    if not doc:
        raise HTTPException(404, f"Route '{route_id}' not found in the demo route catalog.")
    return _to_route_out(doc)


@router.get("/routes/{route_id}/summary", response_model=RouteSummary)
def get_route_summary(route_id: str):
    route = get_route(route_id)
    if not route:
        raise HTTPException(404, f"Route '{route_id}' not found in the demo route catalog.")

    now = datetime.now(timezone.utc)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    hour_ago = now - timedelta(hours=1)

    observations = list(
        events_collection.find({"route_id": route_id, "created_at": {"$gte": start_of_day}})
    )
    distinct_buses = {obs["bus_id"] for obs in observations}

    defects = list(defects_collection.find({"route_id": route_id}))
    confirmed = sum(1 for d in defects if d.get("status") == "confirmed")
    unconfirmed = sum(1 for d in defects if d.get("status") == "unconfirmed")

    hotspots = congestion_collection.count_documents(
        {
            "route_id": route_id,
            "congestion_score": {"$gte": CONGESTION_HOTSPOT_THRESHOLD},
            "created_at": {"$gte": hour_ago},
        }
    )

    return RouteSummary(
        route_id=route_id,
        route_name=route["route_name"],
        buses_recorded=len(distinct_buses),
        observation_count=len(observations),
        defect_count=len(defects),
        confirmed_defect_count=confirmed,
        unconfirmed_defect_count=unconfirmed,
        congestion_hotspot_count=hotspots,
        # Honest combined source: the data is simulator-generated, the route
        # geometry comes from the OSM road network.
        source=f"simulator • geometry: {route.get('geometry_source', 'demo')}" if route.get("geometry_source")
        else "simulator",
    )
