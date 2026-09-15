"""
Build the static road geometry for the demo route catalog.

Run once (already committed as backend/app/services/route_geometry.py):
    cd backend && python scripts/build_route_geometry.py

Data sources (both free, no API key):
  - Nominatim (OpenStreetMap) for endpoint geocoding
  - OSRM public demo server for the actual road-network driving path

The OUTPUT is baked into the repo, so the app itself never needs network
access -- the demo cannot break offline. Geometry credits belong to
OpenStreetMap contributors (same as our map tiles).
"""

from __future__ import annotations

import json
import subprocess
import time
import urllib.parse
from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_M = 6_371_000
USER_AGENT = "GatiShaktiRoadIntelligence-SIH26124/1.0 (hackathon demo)"
RESAMPLE_POINTS = 90  # smooth on the map, tiny payload
ROUND_DECIMALS = 5

# All four demo corridors start at Jalgaon (distictict destinations).
CORRIDORS = [
    ("R-01", "Jalgaon", "Bhusawal"),
    ("R-02", "Jalgaon", "Varangaon"),
    ("R-03", "Jalgaon", "Pachora"),
    ("R-04", "Jalgaon", "Chopda"),
]


def http_json(url: str) -> dict:
    # curl instead of urllib: some Windows Python installs ship with an
    # expired/incomplete CA bundle that breaks certificate verification.
    result = subprocess.run(
        ["curl", "-sS", "--max-time", "40", "-A", USER_AGENT, url],
        capture_output=True, text=True, check=True,
    )
    return json.loads(result.stdout)


def geocode(name: str) -> tuple[float, float]:
    """Return (lng, lat) for a town name in the Jalgaon district area."""
    q = urllib.parse.quote(f"{name}, Jalgaon district, Maharashtra, India")
    data = http_json(f"https://nominatim.openstreetmap.org/search?q={q}&limit=1&format=json")
    if not data:
        raise SystemExit(f"Nominatim found nothing for {name!r}")
    return float(data[0]["lon"]), float(data[0]["lat"])


def osrm_route(start: tuple[float, float], end: tuple[float, float]) -> tuple[list, float, float]:
    """Driving geometry [[lng, lat], ...] + distance_km + duration_min."""
    a, b = f"{start[0]},{start[1]}", f"{end[0]},{end[1]}"
    data = http_json(
        f"https://router.project-osrm.org/route/v1/driving/{a};{b}"
        f"?overview=simplified&geometries=geojson"
    )
    route = data["routes"][0]
    coords = route["geometry"]["coordinates"]
    return coords, route["distance"] / 1000, route["duration"] / 60


def haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    (lng1, lat1), (lng2, lat2) = a, b
    p1, p2 = radians(lat1), radians(lat2)
    dp, dl = radians(lat2 - lat1), radians(lng2 - lng1)
    h = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(h))


def resample(coords: list, n: int) -> list:
    """Evenly resample the polyline to n points by cumulative distance."""
    dists = [0.0]
    for i in range(1, len(coords)):
        dists.append(dists[-1] + haversine_m(coords[i - 1], coords[i]))
    total = dists[-1]
    if total == 0:
        return [coords[0], coords[-1]]
    step, out, j = total / (n - 1), [], 0
    for k in range(n):
        target = step * k
        while j < len(dists) - 2 and dists[j + 1] < target:
            j += 1
        seg = dists[j + 1] - dists[j]
        t = 0.0 if seg == 0 else (target - dists[j]) / seg
        (x0, y0), (x1, y1) = coords[j], coords[j + 1]
        out.append([
            round(x0 + (x1 - x0) * t, ROUND_DECIMALS),
            round(y0 + (y1 - y0) * t, ROUND_DECIMALS),
        ])
    return out


def main() -> None:
    out: dict = {}
    for route_id, origin_name, dest_name in CORRIDORS:
        o = geocode(origin_name)
        d = geocode(dest_name)
        time.sleep(1.1)  # be polite to Nominatim
        coords, dist_km, dur_min = osrm_route(o, d)
        coords = resample(coords, RESAMPLE_POINTS)
        out[route_id] = {
            "origin_name": origin_name,
            "destination_name": dest_name,
            "origin": {"latitude": round(o[1], 6), "longitude": round(o[0], 6)},
            "destination": {"latitude": round(d[1], 6), "longitude": round(d[0], 6)},
            "distance_km": round(dist_km, 1),
            "duration_min": round(dur_min),
            "coordinates": coords,
        }
        print(f"{route_id}: {origin_name} -> {dest_name}  {dist_km:.1f} km, {dur_min:.0f} min, {len(coords)} pts")

    header = '''"""
Static road geometry for the demo route catalog (P0-04).

GENERATED FILE -- do not hand-edit. Rebuild with:
    python scripts/build_route_geometry.py

Geometry: actual road-network driving paths from OSRM over OpenStreetMap
data (© OpenStreetMap contributors), resampled for map rendering. Baked in
as source so the app needs NO network access at runtime -- the demo works
offline, and no claim about live routing services is implied.
"""

from __future__ import annotations

from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_M = 6_371_000

'''

    body = "ROUTE_GEOMETRY: dict[str, dict] = " + json.dumps(out, indent=4) + "\n\n\n"
    helper = '''def _haversine_m(a: list[float], b: list[float]) -> float:
    lat1, lng1, lat2, lng2 = map(radians, [a[1], a[0], b[1], b[0]])
    dlat, dlng = lat2 - lat1, lng2 - lng1
    h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(h))


def point_at_distance_km(route_id: str, km: float) -> tuple[float, float]:
    """Return (lat, lng) km along the route's road polyline. Used by the
    demo simulator so buses/defects/congestion sit ON the actual corridor."""
    coords = ROUTE_GEOMETRY[route_id]["coordinates"]
    if km <= 0:
        lat, lng = coords[0]
        return lat, lng
    dists = [0.0]
    for i in range(1, len(coords)):
        dists.append(dists[-1] + _haversine_m(coords[i - 1], coords[i]))
    target_m = min(km, ROUTE_GEOMETRY[route_id]["distance_km"]) * 1000
    for i in range(1, len(coords)):
        if dists[i] >= target_m or i == len(coords) - 1:
            seg = dists[i] - dists[i - 1]
            t = 0.0 if seg == 0 else (target_m - dists[i - 1]) / seg
            lng = coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t
            lat = coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t
            return round(lat, 6), round(lng, 6)
    lat, lng = coords[-1]
    return lat, lng
'''

    with open("app/services/route_geometry.py", "w", encoding="utf-8") as fh:
        fh.write(header + body + helper)
    print("Wrote app/services/route_geometry.py")


if __name__ == "__main__":
    main()
