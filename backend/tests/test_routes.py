"""
Route Intelligence + scripted demo scenario tests (P0-04/05/06, P0-11).

Run: cd backend && python -m pytest tests/test_routes.py -v
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.db import (
    congestion_collection,
    counters_collection,
    defects_collection,
    events_collection,
    fleet_collection,
    routes_collection,
)
from app.main import app
from app.services.routes_seed import ensure_routes_seeded

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_db():
    events_collection.delete_many({})
    defects_collection.delete_many({})
    fleet_collection.delete_many({})
    congestion_collection.delete_many({})
    counters_collection.delete_many({})
    ensure_routes_seeded()
    yield


def test_routes_catalog_seeded_and_listed():
    r = client.get("/api/v1/routes")
    assert r.status_code == 200
    routes = r.json()
    ids = [route["route_id"] for route in routes]
    assert "R-01" in ids
    r01 = next(route for route in routes if route["route_id"] == "R-01")
    assert r01["route_name"] == "Jalgaon → Bhusawal"
    assert r01["origin"]["name"] == "Jalgaon"
    assert r01["destination"]["name"] == "Bhusawal"
    assert r01["geometry"]["type"] == "LineString"
    assert len(r01["geometry"]["coordinates"]) >= 2


def test_get_route_by_id_and_404():
    r = client.get("/api/v1/routes/R-01")
    assert r.status_code == 200
    assert r.json()["route_id"] == "R-01"

    r2 = client.get("/api/v1/routes/R-999")
    assert r2.status_code == 404
    assert "not found" in r2.json()["detail"].lower()


def test_summary_counts_on_empty_route():
    r = client.get("/api/v1/routes/R-01/summary")
    assert r.status_code == 200
    body = r.json()
    assert body["buses_recorded"] == 0
    assert body["observation_count"] == 0
    assert body["defect_count"] == 0
    assert body["source"].startswith("simulator")


def test_summary_counts_distinct_buses_not_event_rows():
    """Three events from ONE bus = 3 observations but 1 bus recorded (P0-06)."""
    for _ in range(3):
        client.post(
            "/api/v1/events",
            json={
                "bus_id": "BUS_042",
                "route_id": "R-01",
                "location": {"lat": 21.018, "lng": 75.631},
                "confidence": 0.9,
            },
        )
    body = client.get("/api/v1/routes/R-01/summary").json()
    assert body["observation_count"] == 3
    assert body["buses_recorded"] == 1
    assert body["defect_count"] == 1  # same spot + window -> one cluster


def test_summary_defect_split_and_route_isolation():
    # R-01: two distinct spots, two buses on the first -> confirmed.
    client.post(
        "/api/v1/events",
        json={
            "bus_id": "BUS_101",
            "route_id": "R-01",
            "location": {"lat": 21.018, "lng": 75.631},
            "confidence": 0.9,
        },
    )
    client.post(
        "/api/v1/events",
        json={
            "bus_id": "BUS_102",
            "route_id": "R-01",
            "location": {"lat": 21.0181, "lng": 75.6309},
            "confidence": 0.88,
        },
    )
    client.post(
        "/api/v1/events",
        json={
            "bus_id": "BUS_101",
            "route_id": "R-01",
            "location": {"lat": 21.034, "lng": 75.71},
            "confidence": 0.8,
        },
    )
    # R-02: separate route, must not leak into R-01 counts.
    client.post(
        "/api/v1/events",
        json={
            "bus_id": "BUS_103",
            "route_id": "R-02",
            "location": {"lat": 21.04, "lng": 75.82},
            "confidence": 0.8,
        },
    )

    r01 = client.get("/api/v1/routes/R-01/summary").json()
    assert r01["observation_count"] == 3
    assert r01["buses_recorded"] == 2
    assert r01["defect_count"] == 2
    assert r01["confirmed_defect_count"] == 1
    assert r01["unconfirmed_defect_count"] == 1

    r02 = client.get("/api/v1/routes/R-02/summary").json()
    assert r02["observation_count"] == 1
    assert r02["buses_recorded"] == 1


def test_summary_congestion_hotspot_threshold():
    client.post(
        "/api/v1/congestion",
        json={
            "bus_id": "BUS_201",
            "route_id": "R-01",
            "location": {"lat": 21.01, "lng": 75.58},
            "vehicle_density": 90,
            "congestion_score": 0.85,
        },
    )
    client.post(
        "/api/v1/congestion",
        json={
            "bus_id": "BUS_201",
            "route_id": "R-01",
            "location": {"lat": 21.011, "lng": 75.581},
            "vehicle_density": 10,
            "congestion_score": 0.2,
        },
    )
    body = client.get("/api/v1/routes/R-01/summary").json()
    assert body["congestion_hotspot_count"] == 1  # only score >= 0.6


def test_summary_legacy_observations_without_route_are_excluded():
    """Old events without route_id must not crash route queries (P0-04)."""
    client.post(
        "/api/v1/events",
        json={
            "bus_id": "BUS_301",
            "location": {"lat": 21.018, "lng": 75.631},
            "confidence": 0.9,
        },
    )
    body = client.get("/api/v1/routes/R-01/summary").json()
    assert body["observation_count"] == 0


def test_defects_filter_by_route():
    client.post(
        "/api/v1/events",
        json={
            "bus_id": "BUS_401",
            "route_id": "R-01",
            "location": {"lat": 21.018, "lng": 75.631},
            "confidence": 0.9,
        },
    )
    client.post(
        "/api/v1/events",
        json={
            "bus_id": "BUS_402",
            "route_id": "R-02",
            "location": {"lat": 21.04, "lng": 75.82},
            "confidence": 0.9,
        },
    )

    r01 = client.get("/api/v1/defects?route_id=R-01").json()
    assert len(r01) == 1
    assert r01[0]["route_id"] == "R-01"
    assert r01[0]["display_id"] == "DEF-0001"

    all_defects = client.get("/api/v1/defects").json()
    assert len(all_defects) == 2


def test_demo_scenario_produces_confirmed_corroboration_and_evidence():
    r = client.post("/api/v1/simulator/run", json={})
    assert r.status_code == 200
    result = r.json()
    assert result["buses_simulated"] == 8
    assert result["pothole_events_created"] == 10
    assert result["congestion_observations_created"] == 10

    defects = client.get("/api/v1/defects").json()
    assert len(defects) == 7

    # Two confirmed clusters: the flagship 3-bus story on R-01 and a 2-bus
    # one on R-02 -- plus five single-bus unconfirmed defects.
    confirmed = [d for d in defects if d["status"] == "confirmed"]
    assert len(confirmed) == 2
    by_route = {d["route_id"]: d for d in confirmed}
    flagship = by_route["R-01"]
    assert sorted(flagship["unique_bus_ids"]) == ["BUS_001", "BUS_002", "BUS_003"]
    assert flagship["report_count"] == 3
    second = by_route["R-02"]
    assert sorted(second["unique_bus_ids"]) == ["BUS_004", "BUS_005"]

    # P0-09: three DIFFERENT bundled evidence images on the corroborated
    # defect (one per bus camera), and BUS_004's image on the R-02 cluster.
    urls = {obs["bus_id"]: obs["evidence_image_url"] for obs in flagship["observations"]}
    assert urls == {
        "BUS_001": "/evidence/pothole_bus_001.jpg",
        "BUS_002": "/evidence/pothole_bus_002.jpg",
        "BUS_003": "/evidence/pothole_bus_003.jpg",
    }
    assert any(
        obs["evidence_image_url"] == "/evidence/damaged_road_bus_004.jpg"
        for obs in second["observations"]
    )

    # Route summaries line up with the scripted data on every corridor.
    r01 = client.get("/api/v1/routes/R-01/summary").json()
    assert r01["buses_recorded"] == 3
    assert r01["observation_count"] == 4  # 3 corroboration + pothole at 22 km
    assert r01["defect_count"] == 2
    assert r01["confirmed_defect_count"] == 1
    assert r01["congestion_hotspot_count"] == 2  # 0.85 and 0.62 >= 0.6

    r02 = client.get("/api/v1/routes/R-02/summary").json()
    assert r02["buses_recorded"] == 2
    assert r02["observation_count"] == 3
    assert r02["defect_count"] == 2
    assert r02["confirmed_defect_count"] == 1
    assert r02["congestion_hotspot_count"] == 1  # 0.78

    for rid, buses, obs, defects_n, hotspots in (("R-03", 2, 2, 2, 0), ("R-04", 1, 1, 1, 1)):
        body = client.get(f"/api/v1/routes/{rid}/summary").json()
        assert body["buses_recorded"] == buses
        assert body["observation_count"] == obs
        assert body["defect_count"] == defects_n
        assert body["confirmed_defect_count"] == 0
        assert body["congestion_hotspot_count"] == hotspots

    # Human-readable IDs (P1-05) + the timestamp fix: every scripted
    # observation carries its own DISTINCT detected-at time.
    events = client.get("/api/v1/events").json()
    display_ids = sorted(e["display_id"] for e in events if e["display_id"])
    assert display_ids[0] == "EVT-0001"
    observed = [e["observed_at"] for e in events]
    assert len(observed) == 10
    assert len(set(observed)) == len(observed), "timestamps must be distinct"


def test_demo_scenario_is_repeatable_after_reset():
    client.post("/api/v1/simulator/run", json={})
    defects1 = sorted(d["unique_bus_ids"] for d in client.get("/api/v1/defects").json())
    client.post("/api/v1/simulator/reset")

    counters_after_reset = counters_collection.count_documents({})
    assert counters_after_reset == 0, "reset must clear display-ID counters"

    client.post("/api/v1/simulator/run", json={})
    defects2 = sorted(d["unique_bus_ids"] for d in client.get("/api/v1/defects").json())
    assert defects1 == defects2

    events = client.get("/api/v1/events").json()
    display_ids = sorted(e["display_id"] for e in events)
    assert display_ids[0] == "EVT-0001", "counters restart after reset"


def test_routes_survive_demo_reset():
    client.post("/api/v1/simulator/reset")
    assert routes_collection.count_documents({}) == 4
