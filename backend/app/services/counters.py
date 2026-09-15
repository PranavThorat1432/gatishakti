"""Human-readable display IDs (P1-05).

Allocates sequential IDs like EVT-0001 / DEF-0001 via an atomic $inc on a
tiny counters collection. Real MongoDB and mongomock both support find_one
+ update, so this works in either database mode. If allocation ever fails
the caller stores a null display_id and the UI falls back to the raw id --
display IDs are presentation, never a correctness dependency.
"""

from __future__ import annotations

from app.db import counters_collection


def next_display_id(prefix: str, width: int = 4) -> str | None:
    try:
        counters_collection.update_one(
            {"_id": prefix},
            {"$inc": {"seq": 1}},
            upsert=True,
        )
        doc = counters_collection.find_one({"_id": prefix})
        if doc is None:
            return None
        return f"{prefix}-{int(doc['seq']):0{width}d}"
    except Exception:
        return None
