"""
Pothole detection wrapper (continuation-prompt sections 1-2).

MODEL DECISION -- status as of this build:

  Primary candidate:  Samdutse/pothole-yolov8 (Hugging Face) -- yolov8s
                       fine-tuned on the Smartathon pothole dataset
                       (Roboflow Universe). mAP50 0.816, mAP50-95 0.518.
                       Weight file: best.pt.
  Fallback candidate: peterhdd/pothole-detection-yolov8 (Hugging Face) --
                       yolov8s fine-tuned on a custom pothole dataset.

  BOTH are confirmed to exist and are real pothole-specific detectors, not
  generic COCO models -- verified by web search, not assumed.

  NEITHER could be validated in this build environment: this sandbox's
  network allowlist does not include huggingface.co
  (`curl -I https://huggingface.co` -> 403 host_not_allowed, confirmed
  directly). That's an environment/network limitation, not a defect in
  either model.

  What WAS validated here: the inference harness itself (load weights -> run
  -> parse confidence + bbox -> save annotated image), end-to-end, using
  Ultralytics' stock COCO-pretrained yolov8n.pt against a real photo. See
  `model_validation/validate_harness.py` for that script and its output. That
  proves this wrapper's code path is correct. It does NOT prove pothole
  detection works -- yolov8n.pt has no pothole class, so it is never loaded
  here as the production model.

  To finish validation: download best.pt from either HF repo above on a
  machine with normal internet access (or upload the .pt file directly into
  the conversation), point POTHOLE_MODEL_PATH at it, and restart the backend.
  This module will load it lazily on first use -- no code changes needed.

Until POTHOLE_MODEL_PATH points at real, tested pothole weights, this module
runs in "unavailable" mode: /detect returns a clear unavailable response
instead of fabricating a detection. Everything downstream (events, fusion,
dashboard) still works off events submitted directly with a confidence
value, e.g. from the simulator.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import TypedDict

from app.config import get_settings

logger = logging.getLogger("uip.pothole_model")


class Detection(TypedDict):
    class_name: str
    confidence: float
    bbox: list[float]


class DetectionResult(TypedDict):
    available: bool
    detections: list[Detection]
    message: str


_model = None
_load_attempted = False


def _try_load_model():
    global _model, _load_attempted
    if _load_attempted:
        return _model
    _load_attempted = True

    settings = get_settings()
    path = Path(settings.pothole_model_path)
    if not path.exists():
        logger.warning(
            "Pothole model weights not found at %s -- running in unavailable mode.", path
        )
        return None

    try:
        from ultralytics import YOLO  # imported lazily; not a hard dependency

        _model = YOLO(str(path))
        logger.info("Loaded pothole model from %s", path)
    except Exception as exc:  # pragma: no cover
        logger.warning("Failed to load pothole model (%s) -- running in unavailable mode.", exc)
        _model = None
    return _model


def detect_pothole(image_path: str) -> DetectionResult:
    settings = get_settings()
    model = _try_load_model()

    if model is None:
        return {
            "available": False,
            "detections": [],
            "message": "AI inference is unavailable. No pothole model is configured for this "
            "deployment. Submit events with an explicit confidence value (as the fleet "
            "simulator does) to exercise the rest of the pipeline.",
        }

    results = model(image_path, verbose=False)
    detections: list[Detection] = []
    for result in results:
        for box in result.boxes:
            confidence = float(box.conf[0])
            if confidence < settings.ai_confidence_threshold:
                continue
            class_name = model.names[int(box.cls[0])]
            detections.append(
                {
                    "class_name": class_name,
                    "confidence": confidence,
                    "bbox": [float(x) for x in box.xyxy[0].tolist()],
                }
            )

    return {
        "available": True,
        "detections": detections,
        "message": f"{len(detections)} detection(s) at or above threshold "
        f"{settings.ai_confidence_threshold}.",
    }
