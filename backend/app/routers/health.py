from datetime import datetime, timezone

from fastapi import APIRouter

from app.db import is_using_mock_db
from app.services import cloudinary_service, openrouter_service, pothole_model

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    settings_ok = True
    return {
        "status": "ok" if settings_ok else "degraded",
        "time": datetime.now(timezone.utc),
        "database": "mongomock (demo, non-persistent)" if is_using_mock_db() else "connected",
        "integrations": {
            "cloudinary": "configured" if cloudinary_service.is_available() else "unavailable",
            "openrouter": "configured" if openrouter_service.is_available() else "unavailable",
            "pothole_model": "loaded"
            if pothole_model._try_load_model() is not None
            else "unavailable",
        },
    }
