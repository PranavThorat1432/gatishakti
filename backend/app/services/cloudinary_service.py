"""Cloudinary evidence image upload (PRD section 10). Optional -- degrades to
"Evidence media unavailable." when unconfigured, per PRD's own fallback rule."""

from __future__ import annotations

import logging

from app.config import get_settings

logger = logging.getLogger("uip.cloudinary")

_configured = False


def _ensure_configured() -> bool:
    global _configured
    settings = get_settings()
    if not (settings.cloudinary_cloud_name and settings.cloudinary_api_key
            and settings.cloudinary_api_secret):
        return False
    if not _configured:
        import cloudinary

        cloudinary.config(
            cloud_name=settings.cloudinary_cloud_name,
            api_key=settings.cloudinary_api_key,
            api_secret=settings.cloudinary_api_secret,
            secure=True,
        )
        _configured = True
    return True


def is_available() -> bool:
    return _ensure_configured()


def upload_evidence_image(file_bytes: bytes, public_id: str | None = None) -> str | None:
    """Returns a secure URL, or None if Cloudinary isn't configured (caller
    should show 'Evidence media unavailable.' rather than failing the event)."""
    if not _ensure_configured():
        logger.info("Cloudinary not configured -- skipping evidence upload.")
        return None

    import cloudinary.uploader

    result = cloudinary.uploader.upload(
        file_bytes, folder="urban-intel-evidence", public_id=public_id
    )
    return result.get("secure_url")
