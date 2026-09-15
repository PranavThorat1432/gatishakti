"""
Tests for multi-bus fusion: spatial + temporal clustering, unique-bus
deduplication, and the confirmed/unconfirmed threshold.

Run: cd backend && python -m pytest tests/test_fusion.py -v
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.db import defects_collection
from app.models.schemas import GeoPoint
from app.services import fusion


@pytest.fixture(autouse=True)
def _clean_defects():
    defects_collection.delete_many({})
    yield
    defects_collection.delete_many({})


BASE_TIME = datetime(2026, 9, 13, 10, 0, tzinfo=timezone.utc)


def _observe(lat, lng, bus_id, confidence, minutes_after_base):
    return fusion.attach_event_to_defect(
        location=GeoPoint(lat=lat, lng=lng),
        bus_id=bus_id,
        confidence=confidence,
        evidence_image_url=None,
        observed_at=BASE_TIME + timedelta(minutes=minutes_after_base),
    )


def test_spec_scenario_end_to_end():
    """Reproduces the continuation-prompt section 5 example exactly."""
    d1 = _observe(20.0052, 73.7801, "BUS_001", 0.91, 0)
    assert d1["status"] == "unconfirmed"
    assert d1["unique_bus_ids"] == ["BUS_001"]
    defect_id = d1["_id"]

    d2 = _observe(20.0054, 73.7800, "BUS_002", 0.87, 12)
    assert d2["_id"] == defect_id, "obs 2 must attach to the same cluster"
    assert d2["status"] == "confirmed"
    assert set(d2["unique_bus_ids"]) == {"BUS_001", "BUS_002"}

    d3 = _observe(20.0051, 73.7802, "BUS_003", 0.93, 20)
    assert d3["_id"] == defect_id
    assert d3["status"] == "confirmed"
    assert set(d3["unique_bus_ids"]) == {"BUS_001", "BUS_002", "BUS_003"}

    # Same bus (BUS_001) reports again -- must NOT bump unique_bus_count.
    d4 = _observe(20.0052, 73.7801, "BUS_001", 0.90, 22)
    assert d4["_id"] == defect_id
    assert len(d4["unique_bus_ids"]) == 3
    assert d4["report_count"] == 4


def test_same_bus_repeated_observations_do_not_confirm_alone():
    d = _observe(20.01, 73.78, "BUS_001", 0.9, 0)
    for i in range(1, 5):
        d = _observe(20.01, 73.78, "BUS_001", 0.9, i)
    assert d["status"] == "unconfirmed"
    assert len(d["unique_bus_ids"]) == 1
    assert d["report_count"] == 5


def test_observation_outside_spatial_radius_creates_new_defect():
    d1 = _observe(20.0000, 73.7800, "BUS_001", 0.9, 0)
    # ~1km away -- well outside the 25m radius.
    d2 = _observe(20.0100, 73.7900, "BUS_002", 0.9, 1)
    assert d1["_id"] != d2["_id"]
    assert d2["status"] == "unconfirmed"


def test_observation_outside_temporal_window_does_not_merge():
    d1 = _observe(20.0052, 73.7801, "BUS_001", 0.9, 0)
    # Same spot, but 45 minutes later -- outside the 30-minute window.
    d2 = _observe(20.0052, 73.7801, "BUS_002", 0.9, 45)
    assert d1["_id"] != d2["_id"], (
        "an observation outside the fusion window must not merge into a stale defect"
    )
    assert d2["status"] == "unconfirmed"


def test_within_radius_and_within_window_merges():
    d1 = _observe(20.0052, 73.7801, "BUS_001", 0.9, 0)
    d2 = _observe(20.0053, 73.7801, "BUS_002", 0.9, 29)
    assert d1["_id"] == d2["_id"]
    assert d2["status"] == "confirmed"


def test_confirmation_requires_configured_minimum_not_hardcoded():
    from app.config import get_settings

    assert get_settings().defect_min_unique_buses == 2
    assert get_settings().defect_cluster_radius_meters == 25.0
    assert get_settings().defect_fusion_window_minutes == 30.0
