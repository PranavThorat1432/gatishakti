"""
Isolated model-loading/inference HARNESS validation.

IMPORTANT -- read before trusting this output:

This script does NOT validate pothole detection. It validates that the
inference *pipeline* (load weights -> run inference -> parse boxes/confidence
-> draw + save annotated image) works correctly in this environment, using
Ultralytics' stock COCO-pretrained yolov8n.pt.

yolov8n.pt has no "pothole" class. It detects COCO classes (person, bus, car,
etc). Any detections below are real COCO detections on a real photo -- proof
the code path is correct -- but they are NOT pothole detections and must
never be reported as such.

The actual pothole-specific weights (Samdutse/pothole-yolov8, primary
candidate; peterhdd/pothole-detection-yolov8, fallback) are hosted on Hugging
Face. This sandbox's network allowlist does not include huggingface.co
(confirmed: `curl -I https://huggingface.co` -> 403 host_not_allowed), so
those weights cannot be downloaded from inside this environment. This is an
environment/network limitation, not a defect in either candidate model.

To actually validate a real pothole model, either:
  (a) run this same harness on a machine with unrestricted internet, or
  (b) download best.pt from one of the two HF repos above on your own machine
      and upload the .pt file directly into this conversation -- swap
      MODEL_PATH below to point at it and rerun.

Run: python validate_harness.py
"""

from pathlib import Path

from ultralytics import YOLO

HERE = Path(__file__).parent
MODEL_PATH = "yolov8n.pt"  # COCO-pretrained; auto-downloads via GitHub release assets
IMAGE_PATH = HERE / "test_image.jpg"
OUTPUT_PATH = HERE / "annotated_output.jpg"


def main() -> None:
    print(f"Loading model: {MODEL_PATH}")
    model = YOLO(MODEL_PATH)
    print("Model loaded OK.")

    print(f"Running inference on: {IMAGE_PATH}")
    results = model(str(IMAGE_PATH), verbose=False)

    detection_count = 0
    for result in results:
        for box in result.boxes:
            confidence = float(box.conf[0])
            class_name = model.names[int(box.cls[0])]
            x1, y1, x2, y2 = [round(float(v), 1) for v in box.xyxy[0].tolist()]
            print(
                f"  class={class_name!r:12} confidence={confidence:.3f} "
                f"bbox=({x1}, {y1}, {x2}, {y2})"
            )
            detection_count += 1
        result.save(filename=str(OUTPUT_PATH))

    print(f"\n{detection_count} detection(s) returned.")
    print(f"Annotated image saved to: {OUTPUT_PATH}")
    print(
        "\nHARNESS RESULT: PASS -- load -> infer -> confidence/bbox -> annotated "
        "save all work. This is NOT a pothole-detection result (see module "
        "docstring)."
    )


if __name__ == "__main__":
    main()
