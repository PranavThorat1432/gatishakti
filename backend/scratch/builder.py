from pathlib import Path

FRONTEND_DIR = Path("../frontend")

def write_file(rel_path: str, content: str):
    full_path = FRONTEND_DIR / rel_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Wrote {full_path}")

README_MD = """# SIH26124 — Urban Intelligence Platform Frontend

Professional, municipal operations control platform frontend for **Smart India Hackathon Problem Statement SIH26124**: *"AI-Powered Mobile Urban Intelligence Platform Using Public Transport Fleet"*.

---

## 🏛️ System Architecture & Workflow

```
PUBLIC TRANSPORT BUS FLEET
         ↓ (Edge Sensing / GPS / Timestamps)
AI VISUAL POTHOLE DETECTION (YOLOv8s fine-tuned model)
         ↓
FASTAPI BACKEND (http://localhost:8000)
         ↓
MONGODB (Atlas or mongomock fallback)
         ↓
MULTI-BUS SPATIAL-TEMPORAL FUSION (25m Radius / 30m Window)
         ↓
CONFIRMED URBAN DEFECT (2+ Unique Buses)
         ↓
REACT + LEAFLET GIS COMMAND CENTER DASHBOARD
```

---

## 🚀 Key Features

1. **Leaflet GIS Command Center**:
   - Interactive municipal map displaying sensing buses (blue icons), confirmed defects (emerald check pins), unconfirmed defects (amber warning pins), and traffic congestion circles.
   - Dynamic map layer toggles & legend.
2. **Defect Detail Inspection Drawer**:
   - Displays defect ID, status badge (`CONFIRMED` vs `UNCONFIRMED`), fusion corroboration score, unique reporting bus list (`BUS_001`, `BUS_002`, etc.), precise GPS coordinates, timestamps, and Cloudinary computer vision evidence image.
3. **Live API Integration**:
   - Fully wired to FastAPI backend (`VITE_API_BASE_URL=http://localhost:8000`).
   - Centralized API service (`src/services/api.ts`) and TypeScript interfaces (`src/types/api.ts`).
4. **Simulator Control Center**:
   - On-demand simulator triggers to run multi-bus sensing passes and demonstrate real-time defect confirmation during live hackathon judging.
5. **Analytics & Reports**:
   - Recharts visual analytics showing defect severity distribution and bus sensing activity.
6. **Enterprise Municipal UI/UX**:
   - Clean, restrained, high-density light & dark operational design system.

---

## 💻 Setup & Local Development

### 1. Prerequisites
- Node.js (v18+ or v20+)
- FastAPI Backend running on `http://localhost:8000`

### 2. Environment Setup
Create a `.env` file in `frontend/`:
```env
VITE_API_BASE_URL=http://localhost:8000
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 5. Production Build & Type Checking
```bash
npm run build
```

---

## 🎬 Live Hackathon Demo Walkthrough

1. Start Backend: `python -m uvicorn app.main:app --reload --port 8000`
2. Start Frontend: `npm run dev`
3. Open `http://localhost:5173` in browser.
4. Click **"Run Simulator"** in the top header.
5. Observe `BUS_001` reporting a pothole (Status: `UNCONFIRMED`, 1 unique bus).
6. Click **"Run Simulator"** again (Simulates `BUS_002` passing the same location within 25m/30min).
7. Notice the defect status automatically converts to **`CONFIRMED`** with **2 UNIQUE BUSES**.
8. Click the defect marker on the Leaflet map to inspect the detailed operational record and evidence photo.
"""

write_file("README.md", README_MD)
