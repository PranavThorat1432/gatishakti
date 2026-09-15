import tempfile
from pathlib import Path

from fastapi import APIRouter, Form, HTTPException, Query, UploadFile

from app.db import congestion_collection, events_collection
from app.models.schemas import (
    CongestionObservationIn,
    CongestionObservationOut,
    EventSource,
    GeoPoint,
    PotholeEventIn,
    PotholeEventOut,
)
from app.services import cloudinary_service, events as events_service, pothole_model

router = APIRouter(tags=["events"])


def _pothole_out(d: dict) -> PotholeEventOut:
    return PotholeEventOut(
        id=d["_id"],
        display_id=d.get("display_id"),
        bus_id=d["bus_id"],
        route_id=d.get("route_id"),
        location=d["location"],
        confidence=d["confidence"],
        evidence_image_url=d.get("evidence_image_url"),
        source=d["source"],
        timestamp=d.get("timestamp"),
        defect_id=d.get("defect_id"),
        observed_at=d.get("observed_at") or d.get("created_at"),
        created_at=d["created_at"],
    )


@router.post("/events", response_model=PotholeEventOut, status_code=201)
def create_event(payload: PotholeEventIn):
    """Submit a pothole observation directly with a known confidence value
    (this is the path the fleet simulator and any client that already ran its
    own inference use)."""
    return events_service.record_pothole_event(payload)


@router.get("/events", response_model=list[PotholeEventOut])
def list_events(limit: int = Query(default=50, ge=1, le=500)):
    docs = list(events_collection.find({}).sort("created_at", -1).limit(limit))
    return [_pothole_out(d) for d in docs]


@router.get("/events/{event_id}", response_model=PotholeEventOut)
def get_event(event_id: str):
    doc = events_collection.find_one({"_id": event_id})
    if not doc:
        raise HTTPException(404, "Event not found")
    return _pothole_out(doc)


@router.post("/events/with-image", response_model=PotholeEventOut, status_code=201)
async def create_event_with_image(
    bus_id: str = Form(...),
    lat: float = Form(...),
    lng: float = Form(...),
    route_id: str | None = Form(default=None),
    source: EventSource = Form(default=EventSource.simulator),
    image: UploadFile | None = None,
):
    """Image-based ingestion: run the pothole model on the uploaded image,
    use its top detection's confidence, upload the image to Cloudinary as
    evidence (best-effort -- degrades gracefully), and create the event.

    Returns 422 if AI inference is unavailable or finds nothing above
    threshold -- this never fabricates a confidence value."""
    if image is None:
        raise HTTPException(422, "An image file is required for this endpoint.")

    image_bytes = await image.read()
    # Write the upload to a temp file and CLOSE it before inference: on
    # Windows an open handle blocks OpenCV/Ultralytics from re-opening the
    # file, which silently produced zero detections.
    tmp_suffix = Path(image.filename or "upload.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(suffix=tmp_suffix, delete=False) as tmp:
        tmp.write(image_bytes)
        tmp_path = tmp.name
    try:
        detection_result = pothole_model.detect_pothole(tmp_path)
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except OSError:
            pass

    if not detection_result["available"]:
        raise HTTPException(503, detection_result["message"])
    if not detection_result["detections"]:
        raise HTTPException(
            422, "No pothole detected above the confidence threshold in this image."
        )

    top_detection = max(detection_result["detections"], key=lambda d: d["confidence"])
    evidence_url = cloudinary_service.upload_evidence_image(image_bytes, public_id=None)

    payload = PotholeEventIn(
        bus_id=bus_id,
        route_id=route_id,
        location=GeoPoint(lat=lat, lng=lng),
        confidence=top_detection["confidence"],
        evidence_image_url=evidence_url,
        source=source,
    )
    return events_service.record_pothole_event(payload)


@router.post("/events/detect")
async def detect_potholes_in_image(image: UploadFile):
    """Detect-only preview (P0-10): run the pothole model on an image and
    return class/confidence/bbox WITHOUT creating an event. Lets the demo UI
    show the inference step explicitly before the user chooses to submit.
    503 if the model is unavailable -- never fabricates a detection."""
    image_bytes = await image.read()
    tmp_suffix = Path(image.filename or "upload.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(suffix=tmp_suffix, delete=False) as tmp:
        tmp.write(image_bytes)
        tmp_path = tmp.name
    try:
        detection_result = pothole_model.detect_pothole(tmp_path)
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except OSError:
            pass

    if not detection_result["available"]:
        raise HTTPException(503, detection_result["message"])

    return {
        "available": True,
        "detections": detection_result["detections"],
        "message": detection_result["message"],
    }


@router.post("/congestion", response_model=CongestionObservationOut, status_code=201)
def create_congestion_observation(payload: CongestionObservationIn):
    return events_service.record_congestion_observation(payload)


@router.get("/congestion", response_model=list[CongestionObservationOut])
def list_congestion_observations(limit: int = Query(default=200, ge=1, le=1000)):
    docs = list(congestion_collection.find({}).sort("created_at", -1).limit(limit))
    return [
        CongestionObservationOut(
            id=d["_id"],
            bus_id=d["bus_id"],
            route_id=d.get("route_id"),
            location=d["location"],
            vehicle_density=d["vehicle_density"],
            congestion_score=d["congestion_score"],
            source=d["source"],
            timestamp=d.get("timestamp"),
            observed_at=d.get("observed_at") or d.get("created_at"),
            created_at=d["created_at"],
        )
        for d in docs
    ]
