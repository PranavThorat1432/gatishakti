from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.db import congestion_collection, defects_collection, events_collection, fleet_collection
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_db():
    events_collection.delete_many({})
    defects_collection.delete_many({})
    fleet_collection.delete_many({})
    congestion_collection.delete_many({})
    yield


def test_health_reports_mock_db_and_unavailable_integrations():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "mongomock" in body["database"]
    assert body["integrations"]["pothole_model"] in ("unavailable", "loaded")


def test_create_event_persists_and_creates_defect():
    r = client.post(
        "/api/v1/events",
        json={"bus_id": "BUS_010", "location": {"lat": 21.0, "lng": 75.5}, "confidence": 0.8},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["defect_id"]

    r2 = client.get("/api/v1/events")
    assert r2.status_code == 200
    assert len(r2.json()) == 1

    r3 = client.get(f"/api/v1/events/{body['id']}")
    assert r3.status_code == 200


def test_get_event_404_for_unknown_id():
    r = client.get("/api/v1/events/does-not-exist")
    assert r.status_code == 404


def test_get_defect_404_for_unknown_id():
    r = client.get("/api/v1/defects/does-not-exist")
    assert r.status_code == 404


@pytest.mark.parametrize(
    "payload",
    [
        {"bus_id": "BUS_010", "location": {"lat": 91, "lng": 75.5}, "confidence": 0.8},  # bad lat
        {"bus_id": "BUS_010", "location": {"lat": 21.0, "lng": 181}, "confidence": 0.8},  # bad lng
        {"bus_id": "BUS_010", "location": {"lat": 21.0, "lng": 75.5}, "confidence": 1.5},  # bad conf
        {"bus_id": "", "location": {"lat": 21.0, "lng": 75.5}, "confidence": 0.8},  # empty bus_id
    ],
)
def test_invalid_event_payloads_are_rejected(payload):
    r = client.post("/api/v1/events", json=payload)
    assert r.status_code == 422


def test_events_with_image_returns_503_when_model_unavailable(monkeypatch):
    monkeypatch.setattr("app.services.pothole_model._load_attempted", True)
    monkeypatch.setattr("app.services.pothole_model._model", None)
    files = {"image": ("road.jpg", b"not-a-real-image", "image/jpeg")}
    data = {"bus_id": "BUS_020", "lat": "21.0", "lng": "75.5"}
    r = client.post("/api/v1/events/with-image", data=data, files=files)
    assert r.status_code == 503
    assert "unavailable" in r.json()["detail"].lower()


def test_dashboard_summary_reflects_seeded_data():
    client.post(
        "/api/v1/events",
        json={"bus_id": "BUS_030", "location": {"lat": 21.0, "lng": 75.5}, "confidence": 0.8},
    )
    r = client.get("/api/v1/dashboard/summary")
    assert r.status_code == 200
    body = r.json()
    assert body["events_today"] == 1
    assert body["unconfirmed_defects"] == 1
    assert body["confirmed_defects"] == 0


def test_insights_degrades_gracefully_without_openrouter_key(monkeypatch):
    monkeypatch.setattr("app.services.openrouter_service.get_settings", lambda: Settings(openrouter_api_key=None))
    r = client.post("/api/v1/insights")
    assert r.status_code == 200
    body = r.json()
    assert body["available"] is False
    assert "unavailable" in body["insight"].lower()


def test_simulator_run_and_reset():
    """Legacy seeded-random mode, opted into explicitly (default is now the
    scripted demo scenario -- see test_routes.py)."""
    r = client.post(
        "/api/v1/simulator/run",
        json={
            "bus_count": 2,
            "events_per_bus": 2,
            "seed_confirmed_defect": True,
            "scenario": "random",
        },
    )
    assert r.status_code == 200
    assert r.json()["buses_simulated"] == 2

    r2 = client.get("/api/v1/buses")
    assert len(r2.json()) == 2

    r3 = client.post("/api/v1/simulator/reset")
    assert r3.status_code == 204

    r4 = client.get("/api/v1/buses")
    assert len(r4.json()) == 0


def test_simulator_is_deterministic_with_default_seed():
    """The demo must be repeatable: same seed -> same output, every time."""
    payload = {"bus_count": 3, "events_per_bus": 3, "seed_confirmed_defect": True}

    r1 = client.post("/api/v1/simulator/run", json=payload)
    buses1 = client.get("/api/v1/buses").json()
    client.post("/api/v1/simulator/reset")

    r2 = client.post("/api/v1/simulator/run", json=payload)
    buses2 = client.get("/api/v1/buses").json()

    assert r1.json() == r2.json()
    assert [b["location"] for b in buses1] == [b["location"] for b in buses2]
