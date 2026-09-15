"""Shared event ingestion logic. Both the simulator and a future Android client
call this same path, differing only by `source` -- per PRD section 8, the
backend does not otherwise need to know where an event came from.

Fix release: every persisted event additionally gets a human-readable
EVT-xxxx display id (P1-05). Null if allocation fails -- presentation only.
Each event also keeps BOTH clocks: `timestamp` (observed_at, when the edge
device claims the detection happened) and `created_at` (platform ingestion).
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.db import events_collection
from app.models.schemas import (
    CongestionObservationIn,
    CongestionObservationOut,
    PotholeEventIn,
    PotholeEventOut,
    new_id,
)
from app.services import fusion
from app.services.counters import next_display_id


def record_pothole_event(payload: PotholeEventIn) -> PotholeEventOut:
    now = datetime.now(timezone.utc)
    event_id = new_id()
    observed_at = payload.timestamp or now

    defect = fusion.attach_event_to_defect(
        location=payload.location,
        bus_id=payload.bus_id,
        confidence=payload.confidence,
        evidence_image_url=payload.evidence_image_url,
        observed_at=observed_at,
        route_id=payload.route_id,
        event_id=event_id,
        severity=payload.severity.value,
    )

    display_id = next_display_id("EVT")
    doc = {
        "_id": event_id,
        "display_id": display_id,
        **payload.model_dump(mode="json"),
        "defect_id": defect["_id"],
        "observed_at": observed_at,
        "created_at": now,
    }
    events_collection.insert_one(doc)

    return PotholeEventOut(
        id=event_id,
        display_id=display_id,
        defect_id=defect["_id"],
        created_at=now,
        observed_at=observed_at,
        **payload.model_dump(),
    )


def record_congestion_observation(
    payload: CongestionObservationIn,
) -> CongestionObservationOut:
    from app.db import congestion_collection

    now = datetime.now(timezone.utc)
    obs_id = new_id()
    observed_at = payload.timestamp or now
    doc = {
        "_id": obs_id,
        **payload.model_dump(mode="json"),
        "observed_at": observed_at,
        "created_at": now,
    }
    congestion_collection.insert_one(doc)

    return CongestionObservationOut(
        id=obs_id, created_at=now, observed_at=observed_at, **payload.model_dump()
    )
