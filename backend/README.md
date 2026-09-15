# Fleet Sensing Control — Backend (SIH26124)

FastAPI backend for the AI-powered mobile urban intelligence platform.

## Status

Backend P0/P1 from the continuation prompt: done and tested (19 pytest
cases, all passing). Frontend integration and Cloudinary/AI live wiring are
next — see "Known limitations" below.

## Architecture

```
backend/
  app/
    main.py          FastAPI app, CORS, router registration under /api/v1
    config.py         Settings (env-driven, sane defaults, extra="ignore")
    db.py              MongoDB (Atlas) or mongomock fallback for local/demo
    models/schemas.py  Pydantic request/response schemas + validation
    routers/           One file per resource; thin, no business logic
    services/          fusion, events, simulator, cloudinary, openrouter,
                        pothole_model -- all the actual logic lives here
  ai/
    validate_harness.py   isolated model-loading/inference validation script
    models/                put real pothole weights here (gitignored)
  tests/
    test_fusion.py     fusion algorithm correctness (spatial+temporal+dedupe)
    test_api.py        endpoint-level tests (validation, degradation, sim)
```

No microservices, no Redis, no WebSockets, no auth/JWT -- deliberately, per
scope. One FastAPI app, one database.

## Selected pothole model — REAL WEIGHTS, VERIFIED

**Model in use:** `Samdutse/pothole-yolov8` (Hugging Face) -- YOLOv8s
fine-tuned on the Smartathon pothole dataset (Roboflow Universe).
Weight file: `ai/models/best.pt` (gitignored; ~22 MB).

**Verified in this build (P0-10):** the weights were downloaded from
Hugging Face and produce real pothole detections. On the four bundled demo
images (`frontend/public/evidence/`), the model detects `Pothole` at
0.87 / 0.92 / 0.87 / 0.65 confidence -- see the CV panel demo on the
dashboard, which runs `POST /api/v1/events/detect` live. The full chain
image -> inference -> Cloudinary upload -> MongoDB -> defect detail was
exercised end-to-end via `POST /api/v1/events/with-image`.

If `ai/models/best.pt` is missing (fresh clone), the backend runs in honest
"unavailable" mode: `/health` reports `pothole_model: "unavailable"`, the
detect endpoints return `503`, and everything else (simulator, fusion,
routes, dashboard) works unaffected. To restore:

```bash
pip install -r requirements-ai.txt
curl -L -o ai/models/best.pt \
  https://huggingface.co/Samdutse/pothole-yolov8/resolve/main/best.pt
# restart uvicorn -- the model loads lazily on first use
```

No accuracy/benchmark claims are made beyond the observed demo detections.

### Windows note (fixed)

Upload-based inference initially returned zero detections on Windows:
`NamedTemporaryFile` kept its handle open, which blocks
OpenCV/Ultralytics from re-opening the file. Both inference endpoints now
write with `delete=False`, close the handle, run inference, then unlink in
a `finally` block.

## Multi-bus fusion — locked parameters

| Parameter | Value | Env var |
|---|---|---|
| Spatial cluster radius | 25 m | `DEFECT_CLUSTER_RADIUS_METERS` |
| Temporal fusion window | 30 min | `DEFECT_FUSION_WINDOW_MINUTES` |
| Min. unique buses to confirm | 2 | `DEFECT_MIN_UNIQUE_BUSES` |

Algorithm (`app/services/fusion.py`):
1. New observation arrives with `(lat, lng, bus_id, confidence, timestamp)`.
2. Search existing defects within the spatial radius **AND** the temporal
   window of that defect's most recent sighting (`last_seen_at`). Both
   conditions must hold -- spatial-only matching was a real bug caught and
   fixed during this build (an old defect from days ago at the same spot
   would otherwise silently keep absorbing unrelated new reports forever).
3. Match found → attach the observation; no match → create a new cluster.
4. Unique bus IDs are tracked as a set -- a bus reporting the same pothole
   five times counts once, not five.
5. `status = "confirmed"` once `len(unique_bus_ids) >= 2`, else
   `"unconfirmed"`.
6. `confirmation_score` is a simple, explicitly-labeled-as-prototype
   deterministic blend of average detector confidence and bus corroboration
   (capped at 4 buses). It is not a calibrated statistical measure -- don't
   present it as one.

Distance uses the Haversine formula (`EARTH_RADIUS_M = 6,371,000`), not raw
lat/lng degree comparison.

Tested exactly against the spec's own scenario in
`tests/test_fusion.py::test_spec_scenario_end_to_end`, plus edge cases for
outside-radius, outside-window, and same-bus-dedup.

## REST API

All routes except `/health` are under `/api/v1`.

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | DB mode, integration availability |
| POST | `/events` | Submit a pothole observation with known confidence |
| GET | `/events` | List recent events |
| GET | `/events/{id}` | Single event |
| POST | `/events/with-image` | multipart upload → real inference → Cloudinary → event; 503 if AI unavailable, 422 if nothing detected above threshold |
| POST | `/events/detect` | Detect-only preview (no event created); returns class/confidence/bbox |
| GET | `/routes` | Demo route catalog (R-01…R-04, seeded at startup) |
| GET | `/routes/{route_id}` | One route with LineString geometry |
| GET | `/routes/{route_id}/summary` | Corridor intelligence: distinct buses, observations, defect split, congestion hotspots |
| POST/GET | `/congestion` | Congestion observations |
| GET | `/defects` | List defects, optional `?status=` filter |
| GET | `/defects/{id}` | Single defect with full detail |
| GET | `/buses` | Fleet status (`/fleet` kept as a hidden alias) |
| GET | `/dashboard/summary` | KPI counts for the dashboard |
| POST | `/insights` | Optional OpenRouter summary; 200 with `available: false` if unconfigured, never blocks |
| POST | `/simulator/run` | Default `scenario="demo"`: deterministic scripted corroboration demo. `scenario="random"` keeps the legacy seeded run (`seed=42`) |
| POST | `/simulator/reset` | Clears all demo data **and** display-ID counters (204); routes are preserved |

Validation (Pydantic): `bus_id` non-empty, latitude ∈ [-90, 90],
longitude ∈ [-180, 180], confidence ∈ [0, 1] -- all enforced, all tested
(`tests/test_api.py::test_invalid_event_payloads_are_rejected`).

## Setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in what you have; everything optional degrades gracefully
uvicorn app.main:app --reload --port 8000
```

Without `MONGODB_URI` set, the app uses an in-memory `mongomock` store --
fully functional for local dev and the hackathon demo, but data does not
survive a restart. Set `MONGODB_URI` to a real Atlas connection string for
persistence.

## Run the tests

```bash
cd backend
pip install pytest
PYTHONPATH=. python -m pytest tests/ -v
```

30 tests, all passing as of this build: fusion correctness (6), API/
validation/degradation (13), route intelligence + scripted demo scenario
(11).

## MongoDB Atlas setup

1. Create a free-tier cluster on MongoDB Atlas.
2. Create a database user and allow-list your IP (or `0.0.0.0/0` for a
   hackathon demo -- not for anything real).
3. Copy the connection string into `MONGODB_URI` in `.env`.
4. Restart the backend; `/health` will report `"database": "connected"`.

## Cloudinary setup

1. Create a free Cloudinary account, grab cloud name / API key / secret
   from the dashboard.
2. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   in `.env`.
3. `/health` will report `"cloudinary": "configured"`. Without it,
   `upload_evidence_image()` returns `None` and callers show "Evidence
   unavailable" -- verified in `tests/test_api.py`.

## Fleet simulator usage

```bash
curl -X POST localhost:8000/api/v1/simulator/run \
  -H 'content-type: application/json' \
  -d '{"bus_count": 5, "events_per_bus": 3, "seed_confirmed_defect": true}'
```

Deterministic by default (`seed: 42`) so demo runs are repeatable -- verified
in `tests/test_api.py::test_simulator_is_deterministic_with_default_seed`.
Reset before a fresh demo run:

```bash
curl -X POST localhost:8000/api/v1/simulator/reset
```

## Demo procedure (judge script)

1. `uvicorn app.main:app --port 8000` (backend), `npm run dev` (frontend).
2. `POST /api/v1/simulator/reset`, then `POST /api/v1/simulator/run` (or the
   "Run Demo Scenario" button). The scripted scenario creates DEF-0001
   confirmed by BUS_001+BUS_002+BUS_003 with three distinct evidence images,
   DEF-0002/DEF-0003 unconfirmed single-bus defects, and congestion across
   all four intensity tiers on R-01/R-02.
3. Dashboard: observation -> cluster -> confirmed KPIs + DEMO MODE badge.
4. Pothole Detection panel: pick "BUS_002 pass" -> Detect Potholes ->
   real YOLO confidence + bbox -> Create Sensing Event.
5. Road Defects page: All/Confirmed/Unconfirmed tabs; open DEF-0001 ->
   observation log, per-bus evidence, prototype confirmation score.
6. Route Intelligence: Jalgaon -> Bhusawal -> Analyze Route -> corridor
   polyline, KPIs, funnel, pothole list; click a pothole to open its detail.
7. Optional: `POST /api/v1/insights` -- if no `OPENROUTER_API_KEY`, dashboard
   still works, insight panel just says so.

Demo does not depend on Android, live camera, continuous video, or live
internet data feeds; Cloudinary and OpenRouter are optional with graceful
degradation (bundled evidence URLs are frontend-relative demo assets).## Known limitations

- Route geometry is **representative demo polylines**, not road-network-
  matched output of a routing service -- labeled as such in the UI. GPS
  map-matching is deliberately deferred.
- Collection names (`events`/`defects`/`fleet`/`congestion`) differ
cosmetically from the spec's suggested names
(`observations`/`defects`/`buses`/`congestion_observations`) -- functionally
equivalent, kept as-is to avoid churning already-working code.
- `confirmation_score`'s weighting (0.6 confidence / 0.4 corroboration) is an
  arbitrary, documented, non-authoritative prototype default -- don't cite
  it as calibrated.
- Video pipeline, Android client, RBAC/auth: correctly out of scope per
  priority order (P3/P4), not implemented.

## Future extensions

Real-time video clip evidence (rolling buffer → FFmpeg → Cloudinary), Android
edge client (camera + GPS + on-device inference), RBAC with real auth once
there's a login flow to justify it, replacing simulated congestion with real
vehicle-density detection from the same edge pipeline as pothole detection.
