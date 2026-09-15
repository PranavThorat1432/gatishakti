from fastapi import APIRouter, HTTPException, Query

from app.db import defects_collection
from app.models.schemas import DefectOut, DefectStatus

router = APIRouter(tags=["defects"])


def _avg_confidence(d: dict) -> float:
    """Average detector confidence across the defect's observations. Falls
    back to the stored per-observation confidences list for legacy docs."""
    observations = d.get("observations") or []
    if observations:
        values = [o["confidence"] for o in observations]
        return round(sum(values) / len(values), 3)
    confidences = d.get("confidences") or []
    if confidences:
        return round(sum(confidences) / len(confidences), 3)
    return 0.0


def _to_out(d: dict) -> DefectOut:
    return DefectOut(
        id=d["_id"],
        display_id=d.get("display_id"),
        route_id=d.get("route_id"),
        location=d["location"],
        report_count=d["report_count"],
        unique_bus_ids=d["unique_bus_ids"],
        status=d["status"],
        confirmation_score=d["confirmation_score"],
        evidence_image_url=d.get("evidence_image_url"),
        observations=d.get("observations", []),
        severity=d.get("severity"),
        avg_confidence=_avg_confidence(d),
        first_seen_at=d["first_seen_at"],
        last_seen_at=d["last_seen_at"],
    )


@router.get("/defects", response_model=list[DefectOut])
def list_defects(
    status: DefectStatus | None = Query(default=None),
    route_id: str | None = Query(default=None),
):
    """`route_id` filter is additive (P0-06); legacy defects without a
    route_id are simply excluded when filtering by route."""
    query: dict = {}
    if status:
        query["status"] = status.value
    if route_id:
        query["route_id"] = route_id
    docs = list(defects_collection.find(query).sort("last_seen_at", -1))
    return [_to_out(d) for d in docs]


@router.get("/defects/{defect_id}", response_model=DefectOut)
def get_defect(defect_id: str):
    doc = defects_collection.find_one({"_id": defect_id})
    if not doc:
        raise HTTPException(404, "Defect not found")
    return _to_out(doc)
