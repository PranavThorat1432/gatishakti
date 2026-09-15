# Demo Evidence Image Credits

These images are **Demo Evidence for simulated fleet sensing** — they stand in
for future bus-camera captures and are NOT live observations.

All four are real road photographs sourced from Wikimedia Commons under free
licenses, chosen so each one produces a genuine YOLOv8 pothole detection with
the bundled model weights (`backend/ai/models/best.pt`).

| File | Source (Wikimedia Commons) | License |
|---|---|---|
| `pothole_bus_001.jpg` | "A photo of a pothole 2021-07-11.jpg" | CC BY-SA 4.0 |
| `pothole_bus_002.jpg` | "Pothole on local Road in County Monaghan.jpg" | CC0 1.0 |
| `pothole_bus_003.jpg` | "A pothole in Dilova Street in Kyiv.jpg" | CC0 1.0 |
| `damaged_road_bus_004.jpg` | "Pothole in an asphalt pavement.jpg" | CC BY-SA 4.0 |

CC BY-SA images are attributed here; if you redistribute the project, keep
this file alongside the images. The backend demo evidence mapping lives in
`backend/app/services/simulator.py` (`DEMO_EVIDENCE_URLS`).
