# Run Doc — SIH26124 Urban Intelligence Platform

Two processes: a FastAPI backend (port 8000) and a Vite dev server (port 5173).
The Preview tab points at the frontend, which proxies all data calls to the backend.

## 1. Reproduce the uncommitted artifacts (fresh checkout)

This workspace IS the main checkout, so there is nothing to copy — but a fresh
clone needs these steps:

1. **Backend Python env** (venv is gitignored):
   ```bash
   cd backend
   python -m venv .venv
   .venv/Scripts/pip install -r requirements.txt   # use pip3/venv paths for Linux/macOS
   .venv/Scripts/pip install pytest ultralytics     # test + YOLO inference deps
   ```
2. **Backend secrets** (gitignored): copy `.env` from the main checkout, or
   create from `.env.example`. Required for the full demo: `MONGODB_URI`
   (Atlas), `CLOUDINARY_*`, `OPENROUTER_API_KEY`. Everything degrades
   gracefully if unset (mongomock / no evidence upload / no insights).
3. **YOLO weights** (gitignored, ~22 MB):
   ```bash
   curl -L -o backend/ai/models/best.pt \
     https://huggingface.co/Samdutse/pothole-yolov8/resolve/main/best.pt
   ```
4. **Frontend deps** (node_modules is gitignored):
   ```bash
   cd frontend && npm install
   ```
5. **Demo data** (in Mongo): after the backend is up, run
   `POST http://localhost:8000/api/v1/simulator/reset` then
   `POST http://localhost:8000/api/v1/simulator/run` — the deterministic
   scripted scenario: 8 buses across four corridors (all starting at
   Jalgaon), DEF-0001 confirmed by BUS_001/002/003 with evidence images,
   DEF-0002 confirmed on R-02, five single-bus unconfirmed defects, and
   congestion across four intensity tiers. Every observation carries a
   distinct staggered detected-at timestamp (6-min cadence).

**Route geometry** is REAL road-network data (OSRM over OpenStreetMap),
baked into `backend/app/services/route_geometry.py`. To regenerate it
(requires internet, one-time):
```bash
cd backend && python scripts/build_route_geometry.py
```
The app itself needs NO network for routing — the demo works offline.

## 2. Run the servers

**Backend** (start first):
```bash
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000
```
Health check: `curl http://localhost:8000/health` → `"status": "ok"`,
`pothole_model: "loaded"` when weights are present.

**Frontend** (detached on Windows, per the platform recipe — stdout and stderr
must go to DIFFERENT files):
```bash
powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory '<abs path>\frontend' -RedirectStandardOutput '<abs path>\.freebuff\preview.log' -RedirectStandardError '<abs path>\.freebuff\preview.log.err' -WindowStyle Hidden -PassThru).Id"
```
Then confirm the pid is alive (`Get-Process -Id <pid>`) and
`curl http://localhost:5173/` answers 200.

- Vite picks the free port starting at 5173; if 5173 is taken it uses 5174 —
  but the backend CORS allow-list (`CORS_ORIGINS` in `backend/.env`) only
  includes `http://localhost:5173`. Keep 5173 free, or add the new origin to
  `CORS_ORIGINS` and restart the backend.
- Tests: `cd backend && .venv/Scripts/python.exe -m pytest tests/` (30 pass).
- Production build check: `cd frontend && npm run build`.
