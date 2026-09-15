"""
Database access.

Uses a real MongoDB (Atlas or otherwise) when MONGODB_URI is set. When it is
not set -- e.g. running this prototype without provisioning a cluster -- it
falls back to `mongomock`, an in-memory Mongo-compatible store, so the API is
still fully runnable for local development and demos.

This fallback is explicitly a demo convenience, not a production behavior:
data does not persist across restarts, and it is not what "MongoDB Atlas
preferred" in the PRD means. Set MONGODB_URI to use a real database.
"""

import logging

from app.config import get_settings

logger = logging.getLogger("uip.db")

_settings = get_settings()
_using_mock = False

if _settings.mongodb_uri:
    from pymongo import MongoClient

    client = MongoClient(_settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    try:
        client.admin.command("ping")
        logger.info("Connected to configured MongoDB.")
    except Exception as exc:  # pragma: no cover - network dependent
        logger.warning("MONGODB_URI set but unreachable (%s); falling back to mongomock.", exc)
        import mongomock

        client = mongomock.MongoClient()
        _using_mock = True
else:
    import mongomock

    logger.warning("MONGODB_URI not set -- using in-memory mongomock store for this run only.")
    client = mongomock.MongoClient()
    _using_mock = True

db = client[_settings.mongodb_db]

events_collection = db["events"]
defects_collection = db["defects"]
congestion_collection = db["congestion"]
fleet_collection = db["fleet"]
routes_collection = db["routes"]
counters_collection = db["counters"]


def is_using_mock_db() -> bool:
    return _using_mock


def ensure_indexes() -> None:
    events_collection.create_index("bus_id")
    events_collection.create_index("created_at")
    events_collection.create_index("route_id")
    defects_collection.create_index([("location.lat", 1), ("location.lng", 1)])
    defects_collection.create_index("route_id")
    congestion_collection.create_index("created_at")
    congestion_collection.create_index("route_id")
    fleet_collection.create_index("bus_id", unique=True)
    routes_collection.create_index("route_id", unique=True)
