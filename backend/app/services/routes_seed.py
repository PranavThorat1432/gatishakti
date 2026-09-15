"""
Route / corridor seed data and lookup (P0-04).

The catalog is four demo corridors radiating from Jalgaon (Maharashtra):
  R-01 Jalgaon -> Bhusawal      R-02 Jalgaon -> Varangaon
  R-03 Jalgaon -> Pachora       R-04 Jalgaon -> Chopda

Geometry is the ACTUAL road-network driving path (OSRM over OpenStreetMap,
© OpenStreetMap contributors), generated once by
scripts/build_route_geometry.py and baked into route_geometry.py -- the app
has zero runtime routing dependency, so the demo works offline. Distances
and durations come from the same road-network computation (not straight-line
estimates).
"""

from __future__ import annotations

from app.db import routes_collection
from app.services.route_geometry import ROUTE_GEOMETRY

ROUTE_META: dict[str, dict] = {
    "R-01": {"origin_name": "Jalgaon", "destination_name": "Bhusawal"},
    "R-02": {"origin_name": "Jalgaon", "destination_name": "Varangaon"},
    "R-03": {"origin_name": "Jalgaon", "destination_name": "Pachora"},
    "R-04": {"origin_name": "Jalgaon", "destination_name": "Chopda"},
}


def _build_seed() -> list[dict]:
    seeds: list[dict] = []
    for route_id in ("R-01", "R-02", "R-03", "R-04"):
        geo = ROUTE_GEOMETRY[route_id]
        meta = ROUTE_META[route_id]
        seeds.append(
            {
                "route_id": route_id,
                "route_name": f"{meta['origin_name']} → {meta['destination_name']}",
                "origin": {
                    "name": meta["origin_name"],
                    "latitude": geo["origin"]["latitude"],
                    "longitude": geo["origin"]["longitude"],
                },
                "destination": {
                    "name": meta["destination_name"],
                    "latitude": geo["destination"]["latitude"],
                    "longitude": geo["destination"]["longitude"],
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": geo["coordinates"],
                },
                "active": True,
                # Additive metadata from the road-network computation.
                "distance_km": geo["distance_km"],
                "duration_min": geo["duration_min"],
                "geometry_source": "osrm-osm",
            }
        )
    return seeds


ROUTES_SEED: list[dict] = _build_seed()


def ensure_routes_seeded() -> None:
    """Idempotent upsert on route_id -- safe to call on every startup, and
    refreshes geometry if the baked geometry module is ever regenerated."""
    for route in ROUTES_SEED:
        routes_collection.update_one(
            {"route_id": route["route_id"]},
            {"$set": route},
            upsert=True,
        )


def get_route(route_id: str) -> dict | None:
    return routes_collection.find_one({"route_id": route_id})
