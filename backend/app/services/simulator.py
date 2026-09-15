"""
Fleet simulator (PRD sections: 'demo fleet simulator' MVP requirement, 38
demo data, 45/46 simulator endpoint).

Two entry points share the SAME ingestion path a real Android edge client
would use (POST /api/v1/events via services.events):

1. run_demo_scenario (default) -- the deterministic scripted judge demo
   (P0-11): on R-01, BUS_001/002/003 corroborate one pothole into a
   CONFIRMED defect; every other route gets its own potholes (R-02 with a
   2-bus confirmed one) and congestion observations spanning the intensity
   tiers. All coordinates are sampled from the actual road polylines, and
   timestamps are deterministically staggered so the corroboration story
   reads like the PRD's 10:30 -> 10:36 -> 10:42 script. Fully repeatable
   after /simulator/reset.

2. run_simulation (legacy, kept for backward compatibility) -- the original
   seeded-random run; still deterministic for a given seed.

Everything is clearly simulated/representative data, per PRD rule 20 --
never presented as live.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from app.db import fleet_collection
from app.models.schemas import (
    CongestionObservationIn,
    EventSource,
    GeoPoint,
    PotholeEventIn,
    SimulatorRunResult,
    Severity,
)
from app.services import events as events_service
from app.services.route_geometry import point_at_distance_km

ROUTE_IDS = ["R-01", "R-02", "R-03", "R-04"]

# Bundled demo evidence images served by the frontend from /evidence/
# (P0-09). Clearly Demo Evidence for simulated fleet sensing -- not live
# bus-camera captures. Different images on the same confirmed cluster make
# the multi-bus fusion story visually convincing (BUS_001/002/003 each saw
# the same pothole from their own camera).
DEMO_EVIDENCE_URLS = {
    "BUS_001": "/evidence/pothole_bus_001.jpg",
    "BUS_002": "/evidence/pothole_bus_002.jpg",
    "BUS_003": "/evidence/pothole_bus_003.jpg",
    "BUS_004": "/evidence/damaged_road_bus_004.jpg",
}

# Fleet: two buses per corridor, positioned at deterministic km marks
# ALONG the actual road polylines.
FLEET_SEEDS = [
    ("BUS_001", "R-01", 3.0),
    ("BUS_002", "R-01", 18.0),
    ("BUS_003", "R-01", 27.0),
    ("BUS_004", "R-02", 8.0),
    ("BUS_005", "R-02", 25.0),
    ("BUS_006", "R-03", 20.0),
    ("BUS_007", "R-03", 38.0),
    ("BUS_008", "R-04", 15.0),
]

# Scripted potholes: (route, km-along-route, severity, reporters, confidences)
SCRIPTED_POTHOLES = [
    # Flagship: 3-bus corroboration story on R-01 (Jalgaon -> Bhusawal).
    ("R-01", 9.5, Severity.high, ["BUS_001", "BUS_002", "BUS_003"], [0.91, 0.89, 0.87]),
    # R-02: a 2-bus confirmed defect -- proof confirmation works on any corridor.
    ("R-02", 12.0, Severity.medium, ["BUS_004", "BUS_005"], [0.84, 0.80]),
    # Single-bus reports: stay UNCONFIRMED until another bus corroborates.
    ("R-01", 22.0, Severity.medium, ["BUS_003"], [0.87]),
    ("R-02", 30.0, Severity.medium, ["BUS_005"], [0.82]),
    ("R-03", 25.0, Severity.medium, ["BUS_006"], [0.86]),
    ("R-03", 45.0, Severity.low, ["BUS_007"], [0.79]),
    ("R-04", 28.0, Severity.medium, ["BUS_008"], [0.83]),
]

# Evidence attached per reporting bus for specific pothole spots.
EVIDENCE_BY_SPOT: dict[tuple[str, float], dict[str, str]] = {
    ("R-01", 9.5): {
        "BUS_001": DEMO_EVIDENCE_URLS["BUS_001"],
        "BUS_002": DEMO_EVIDENCE_URLS["BUS_002"],
        "BUS_003": DEMO_EVIDENCE_URLS["BUS_003"],
    },
    ("R-02", 12.0): {"BUS_004": DEMO_EVIDENCE_URLS["BUS_004"]},
}

SCRIPTED_CONGESTION = [
    # route, km, bus, vehicle_density, congestion_score
    ("R-01", 6.0, "BUS_001", 85, 0.85),   # severe
    ("R-01", 17.0, "BUS_002", 62, 0.62),  # high
    ("R-01", 30.0, "BUS_003", 34, 0.32),  # moderate
    ("R-02", 10.0, "BUS_004", 12, 0.15),  # low
    ("R-02", 20.0, "BUS_005", 78, 0.78),  # severe
    ("R-02", 33.0, "BUS_004", 30, 0.30),  # moderate
    ("R-03", 22.0, "BUS_006", 55, 0.55),  # high
    ("R-03", 44.0, "BUS_007", 20, 0.20),  # low
    ("R-04", 12.0, "BUS_008", 80, 0.80),  # severe
    ("R-04", 35.0, "BUS_008", 40, 0.40),  # moderate
]

# Sub-metre offsets keep corroborating observations inside the 25 m
# cluster radius while remaining distinct GPS readings.
_CORROBORATION_OFFSETS = [
    (0.00000, 0.00000),
    (0.00012, -0.00010),
    (-0.00008, 0.00014),
]

# Deterministic staggered observation clock: event #n is backdated n*6
# minutes, so every observation carries a DISTINCT detected-at time and
# corroborating buses read like the PRD's 10:30 -> 10:36 -> 10:42 script
# (consecutive reports are 6 min apart, well inside the 30-min fusion
# window).
STAGGER_STEP_MINUTES = 6


def _upsert_bus(bus_id: str, route_id: str, lat: float, lng: float, now: datetime) -> None:
    fleet_collection.update_one(
        {"bus_id": bus_id},
        {
            "$set": {
                "bus_id": bus_id,
                "route_id": route_id,
                "location": {"lat": lat, "lng": lng},
                "last_seen_at": now,
                "status": "active",
            }
        },
        upsert=True,
    )


def _record(
    bus_id: str,
    route_id: str,
    lat: float,
    lng: float,
    confidence: float,
    severity: Severity,
    observed_at: datetime,
    evidence_image_url: str | None,
) -> None:
    events_service.record_pothole_event(
        PotholeEventIn(
            bus_id=bus_id,
            route_id=route_id,
            location=GeoPoint(lat=lat, lng=lng),
            confidence=confidence,
            severity=severity,
            evidence_image_url=evidence_image_url,
            source=EventSource.simulator,
            timestamp=observed_at,
        )
    )


def _record_congestion(
    bus_id: str,
    route_id: str,
    lat: float,
    lng: float,
    density: int,
    score: float,
    observed_at: datetime,
) -> None:
    events_service.record_congestion_observation(
        CongestionObservationIn(
            bus_id=bus_id,
            route_id=route_id,
            location=GeoPoint(lat=lat, lng=lng),
            vehicle_density=density,
            congestion_score=score,
            source=EventSource.simulator,
            timestamp=observed_at,
        )
    )


def run_demo_scenario(with_evidence: bool = True) -> SimulatorRunResult:
    """The scripted demo (P0-11). Deterministic: reset -> run reproduces the
    exact same defect/confirmation state every time."""
    now = datetime.now(timezone.utc)

    # Step 1 -- seed the demo fleet (fictional buses on the real corridors).
    for bus_id, route_id, km in FLEET_SEEDS:
        lat, lng = point_at_distance_km(route_id, km)
        _upsert_bus(bus_id, route_id, lat, lng, now)

    pothole_events_created = 0
    event_index = 0

    # Steps 2-5 -- scripted potholes per corridor. Corroborating buses hit
    # the same spot within the fusion radius; each observation gets its own
    # deterministic detected-at timestamp.
    for route_id, km, severity, buses, confidences in SCRIPTED_POTHOLES:
        base_lat, base_lng = point_at_distance_km(route_id, km)
        evidence_map = EVIDENCE_BY_SPOT.get((route_id, km), {}) if with_evidence else {}
        for j, (bus_id, confidence) in enumerate(zip(buses, confidences)):
            d_lat, d_lng = _CORROBORATION_OFFSETS[j % len(_CORROBORATION_OFFSETS)]
            observed_at = now - timedelta(
                minutes=event_index * STAGGER_STEP_MINUTES
            )
            _record(
                bus_id=bus_id,
                route_id=route_id,
                lat=round(base_lat + d_lat, 6),
                lng=round(base_lng + d_lng, 6),
                confidence=confidence,
                severity=severity,
                observed_at=observed_at,
                evidence_image_url=evidence_map.get(bus_id),
            )
            event_index += 1
            pothole_events_created += 1

    # Step 6 -- congestion observations across ALL demo routes, scores
    # spanning the four intensity tiers so the graduated-circle layer reads.
    congestion_created = 0
    for route_id, km, bus_id, density, score in SCRIPTED_CONGESTION:
        lat, lng = point_at_distance_km(route_id, km)
        observed_at = now - timedelta(
            minutes=event_index * STAGGER_STEP_MINUTES
        )
        _record_congestion(bus_id, route_id, lat, lng, density, score, observed_at)
        event_index += 1
        congestion_created += 1

    return SimulatorRunResult(
        buses_simulated=len(FLEET_SEEDS),
        pothole_events_created=pothole_events_created,
        congestion_observations_created=congestion_created,
        defects_touched=len(SCRIPTED_POTHOLES),
    )


def run_simulation(
    bus_count: int,
    events_per_bus: int,
    seed_confirmed_defect: bool,
    seed: int | None = 42,
) -> SimulatorRunResult:
    """`seed` defaults to a fixed value so the demo is repeatable run-to-run,
    per the spec's "the simulator must be repeatable" requirement. Pass
    seed=None for genuinely random variation instead. Kept as the legacy
    `scenario="random"` mode."""
    rng = random.Random(seed)
    now = datetime.now(timezone.utc)
    pothole_events_created = 0
    congestion_created = 0
    touched_defects: set[str] = set()

    # Legacy anchors stay near the old reference point; events land on the
    # R-01 corridor by construction of the old demo geography.
    for i in range(bus_count):
        bus_id = f"BUS_{i + 1:03d}"
        route_id = ROUTE_IDS[i % len(ROUTE_IDS)]
        lat, lng = point_at_distance_km("R-01", 3.0 + 6.0 * (i % 4))
        _upsert_bus(bus_id, route_id, lat, lng, now)

        for j in range(events_per_bus):
            # Roughly 40% of events land on a shared hotspot so
            # independent buses corroborate the same defect; the rest are
            # scattered along the corridor, one-off, unconfirmed reports.
            if seed_confirmed_defect and rng.random() < 0.4:
                base_idx = rng.randrange(len(_CORROBORATION_OFFSETS))
                d_lat, d_lng = _CORROBORATION_OFFSETS[base_idx]
                base_lat, base_lng = point_at_distance_km("R-01", 9.5)
                event_lat = base_lat + d_lat + rng.uniform(-0.000015, 0.000015)
                event_lng = base_lng + d_lng + rng.uniform(-0.000015, 0.000015)
            else:
                base_lat, base_lng = point_at_distance_km(
                    "R-01", rng.uniform(0, 30)
                )
                event_lat = base_lat + rng.uniform(-0.0002, 0.0002)
                event_lng = base_lng + rng.uniform(-0.0002, 0.0002)

            event = PotholeEventIn(
                bus_id=bus_id,
                route_id=route_id,
                location=GeoPoint(lat=event_lat, lng=event_lng),
                confidence=round(rng.uniform(0.55, 0.97), 2),
                source=EventSource.simulator,
            )
            result = events_service.record_pothole_event(event)
            pothole_events_created += 1
            if result.defect_id:
                touched_defects.add(result.defect_id)

            if j == 0:
                cong_lat, cong_lng = point_at_distance_km("R-01", rng.uniform(0, 30))
                _record_congestion(
                    bus_id,
                    route_id,
                    cong_lat,
                    cong_lng,
                    rng.randint(5, 95),
                    round(rng.uniform(0.1, 0.95), 2),
                    now,
                )
                congestion_created += 1

    return SimulatorRunResult(
        buses_simulated=bus_count,
        pothole_events_created=pothole_events_created,
        congestion_observations_created=congestion_created,
        defects_touched=len(touched_defects),
    )
