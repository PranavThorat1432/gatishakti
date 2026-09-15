from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


def _now() -> datetime:
    return datetime.now(timezone.utc)


class EventSource(str, Enum):
    simulator = "simulator"
    android = "android"


class DefectStatus(str, Enum):
    unconfirmed = "unconfirmed"
    confirmed = "confirmed"


class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class GeoPoint(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class PotholeEventIn(BaseModel):
    bus_id: str = Field(min_length=1, max_length=32)
    event_type: Literal["pothole"] = "pothole"
    route_id: str | None = None
    location: GeoPoint
    confidence: float = Field(ge=0, le=1)
    severity: Severity = Severity.medium
    evidence_image_url: str | None = None
    evidence_video_url: str | None = None
    source: EventSource = EventSource.simulator
    timestamp: datetime | None = None

    @field_validator("bus_id")
    @classmethod
    def _strip_bus_id(cls, v: str) -> str:
        return v.strip()


class PotholeEventOut(PotholeEventIn):
    id: str
    display_id: str | None = None
    defect_id: str | None = None
    created_at: datetime
    # When the observation claims to have been made (edge clock). Distinct
    # from created_at = when the platform ingested it.
    observed_at: datetime | None = None


class CongestionObservationIn(BaseModel):
    bus_id: str = Field(min_length=1, max_length=32)
    route_id: str | None = None
    location: GeoPoint
    vehicle_density: int = Field(ge=0, le=500)
    congestion_score: float = Field(ge=0, le=1)
    source: EventSource = EventSource.simulator
    timestamp: datetime | None = None


class CongestionObservationOut(CongestionObservationIn):
    id: str
    created_at: datetime
    observed_at: datetime | None = None


class DefectObservation(BaseModel):
    event_id: str | None = None
    bus_id: str
    confidence: float
    evidence_image_url: str | None = None
    observed_at: datetime


class DefectOut(BaseModel):
    id: str
    display_id: str | None = None
    route_id: str | None = None
    location: GeoPoint
    report_count: int
    unique_bus_ids: list[str]
    status: DefectStatus
    confirmation_score: float
    evidence_image_url: str | None = None
    observations: list[DefectObservation] = []
    severity: Severity | None = None
    avg_confidence: float = 0.0
    first_seen_at: datetime
    last_seen_at: datetime


class BusStatus(BaseModel):
    bus_id: str
    route_id: str | None = None
    location: GeoPoint
    last_seen_at: datetime
    status: Literal["active", "idle"] = "active"


class SimulatorRunRequest(BaseModel):
    bus_count: int = Field(default=4, ge=1, le=12)
    events_per_bus: int = Field(default=3, ge=1, le=20)
    seed_confirmed_defect: bool = True
    scenario: Literal["demo", "random"] = "demo"
    seed_evidence_images: bool = True
    seed: int | None = Field(
        default=42,
        description="Fixed by default so demo runs are repeatable. Pass null for random variation.",
    )


class SimulatorRunResult(BaseModel):
    buses_simulated: int
    pothole_events_created: int
    congestion_observations_created: int
    defects_touched: int


def new_id() -> str:
    return uuid4().hex[:12]
