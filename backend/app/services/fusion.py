"""
Multi-bus fusion (PRD section 11-12).

For each incoming pothole observation:
  1. search existing nearby defects
  2. if one is within the configured radius, attach the observation to it
  3. otherwise create a new defect
  4. update report count and the unique-bus-id set
  5. recompute the confirmation score
  6. set status: unconfirmed / confirmed, where confirmed requires
     unique_bus_count >= 2 (repeated reports from the same bus never confirm
     a defect on their own -- independence is by bus_id, not report count)

Fix-release additions (P0-04/P0-06/P1-05/P1-07): defects also carry the
route_id of the observation that created them, a human-readable DEF-xxxx
display id, and a per-observation log (bus, confidence, evidence URL,
timestamp) so the defect detail view can show the observation -> cluster ->
confirmation story. All of these are additive; older defect documents
without them keep working (accessed via .get()).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt

from app.config import get_settings
from app.db import defects_collection
from app.models.schemas import DefectStatus, GeoPoint, new_id
from app.services.counters import next_display_id

EARTH_RADIUS_M = 6_371_000


def haversine_distance_m(a: GeoPoint, b: GeoPoint) -> float:
    lat1, lng1, lat2, lng2 = map(radians, [a.lat, a.lng, b.lat, b.lng])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(h))


def confirmation_score(avg_confidence: float, unique_bus_count: int) -> float:
    """
    Deterministic, explicitly non-authoritative score (PRD section 12):
    weighted average of detector confidence and independent-bus corroboration.
    Bus corroboration is capped at 4 buses for the purpose of the score so a
    single very-frequently-passed route doesn't dominate it.
    """
    corroboration = min(unique_bus_count, 4) / 4
    score = 0.6 * avg_confidence + 0.4 * corroboration
    return round(min(score, 1.0), 3)


def _as_aware_utc(value: datetime) -> datetime:
    """Real MongoDB (via pymongo) returns naive UTC datetimes; mongomock keeps
    whatever was stored. Normalize both to aware UTC before comparing, or a
    real-Atlas deployment would throw on the very first fusion check."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def find_candidate_defect(location: GeoPoint, observed_at: datetime) -> dict | None:
    """A new observation only fuses into an existing defect if it is BOTH:
      - within the spatial cluster radius, AND
      - within the temporal fusion window of that defect's most recent sighting.
    Spatial-only matching was the bug this replaced: without the temporal
    check, an old defect from days ago would silently keep absorbing new,
    unrelated reports forever (fails the "outside temporal window must not
    incorrectly merge" case)."""
    settings = get_settings()
    radius = settings.defect_cluster_radius_meters
    window = timedelta(minutes=settings.defect_fusion_window_minutes)
    now = _as_aware_utc(observed_at)

    for candidate in defects_collection.find({}):
        candidate_point = GeoPoint(**candidate["location"])
        if haversine_distance_m(location, candidate_point) > radius:
            continue
        last_seen = _as_aware_utc(candidate["last_seen_at"])
        if now - last_seen > window:
            continue
        return candidate
    return None


# Backwards-compatible alias for the old (buggy, spatial-only) name.
def find_nearby_defect(location: GeoPoint, observed_at: datetime | None = None) -> dict | None:
    return find_candidate_defect(location, observed_at or datetime.now(timezone.utc))


_SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2}


def attach_event_to_defect(
    location: GeoPoint,
    bus_id: str,
    confidence: float,
    evidence_image_url: str | None,
    observed_at: datetime | None = None,
    route_id: str | None = None,
    event_id: str | None = None,
    severity: str | None = None,
) -> dict:
    """Attach a pothole observation to an existing/new defect cluster and
    return the updated defect document."""
    now = observed_at or datetime.now(timezone.utc)
    existing = find_candidate_defect(location, now)

    observation_entry = {
        "event_id": event_id,
        "bus_id": bus_id,
        "confidence": confidence,
        "evidence_image_url": evidence_image_url,
        "observed_at": now,
    }

    if existing is None:
        defect = {
            "_id": new_id(),
            "display_id": next_display_id("DEF"),
            "route_id": route_id,
            "location": location.model_dump(),
            "report_count": 1,
            "unique_bus_ids": [bus_id],
            "confidences": [confidence],
            "status": DefectStatus.unconfirmed.value,
            "confirmation_score": confirmation_score(confidence, 1),
            "evidence_image_url": evidence_image_url,
            "observations": [observation_entry],
            "severity": severity,
            "first_seen_at": now,
            "last_seen_at": now,
        }
        defects_collection.insert_one(defect)
        return defect

    unique_bus_ids = set(existing["unique_bus_ids"])
    unique_bus_ids.add(bus_id)
    confidences = existing.get("confidences", []) + [confidence]
    avg_confidence = sum(confidences) / len(confidences)
    status = (
        DefectStatus.confirmed.value
        if len(unique_bus_ids) >= get_settings().defect_min_unique_buses
        else DefectStatus.unconfirmed.value
    )

    update = {
        "report_count": existing["report_count"] + 1,
        "unique_bus_ids": sorted(unique_bus_ids),
        "confidences": confidences,
        "status": status,
        "confirmation_score": confirmation_score(avg_confidence, len(unique_bus_ids)),
        "last_seen_at": now,
    }
    if evidence_image_url and not existing.get("evidence_image_url"):
        update["evidence_image_url"] = evidence_image_url
    if route_id and not existing.get("route_id"):
        update["route_id"] = route_id
    if not existing.get("display_id"):
        update["display_id"] = next_display_id("DEF")
    if severity:
        existing_rank = _SEVERITY_RANK.get(existing.get("severity") or "", -1)
        if _SEVERITY_RANK.get(severity, -1) > existing_rank:
            update["severity"] = severity
    existing.setdefault("observations", []).append(observation_entry)
    update["observations"] = existing["observations"]

    defects_collection.update_one({"_id": existing["_id"]}, {"$set": update})
    existing.update(update)
    return existing
