import { useRef, useState } from "react";
import { api } from "../../services/api";
import type { DetectResponse } from "../../types/api";
import { ScanSearch, Upload, Loader2 } from "lucide-react";

interface VisionDemoProps {
  onEventCreated?: () => void;
}

const DEMO_IMAGES = [
  { label: "BUS_001 pass", url: "/evidence/pothole_bus_001.png" },
  { label: "BUS_002 pass", url: "/evidence/pothole_bus_002.jpg" },
  { label: "BUS_003 pass", url: "/evidence/pothole_bus_002.png" },
  { label: "BUS_004 pass", url: "/evidence/damaged_road_bus_004.jpg" },
];

export function VisionDemo({ onEventCreated }: VisionDemoProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<DetectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inferring, setInferring] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickDemoImage = (url: string) => {
    setImageUrl(url);
    setFile(null);
    setResult(null);
    setError(null);
    setSubmitted(false);
  };

  const pickUpload = (f: File) => {
    setFile(f);
    setImageUrl(URL.createObjectURL(f));
    setResult(null);
    setError(null);
    setSubmitted(false);
  };

  const runDetection = async () => {
    if (!file && !imageUrl) return;
    setInferring(true);
    setError(null);
    setResult(null);
    try {
      let response: DetectResponse;
      if (file) {
        response = await api.detectPothole(file);
      } else {
        // Bundled demo image: fetch it client-side so it flows through the
        // same inference endpoint an uploaded image would.
        const blob = await fetch(imageUrl!).then((r) => {
          if (!r.ok) throw new Error("Could not read the demo image.");
          return r.blob();
        });
        response = await api.detectPothole(new File([blob], "demo.jpg", { type: "image/jpeg" }));
      }
      setResult(response);
      if (!response.detections.length) {
        setError("No pothole detected above the confidence threshold in this image.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Inference request failed.";
      setError(
        message.includes("503")
          ? "AI inference is unavailable on this deployment. The simulator and central platform continue to work."
          : message
      );
    } finally {
      setInferring(false);
    }
  };

  const topDetection = result?.detections.length
    ? result.detections.reduce((a, b) => (b.confidence > a.confidence ? b : a))
    : null;

  const createEvent = async () => {
    if (!topDetection) return;
    setSubmitting(true);
    setError(null);
    try {
      const buses = ["BUS_101", "BUS_102", "BUS_103"];
      const busId = buses[Math.floor(Math.random() * buses.length)];
      await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}/api/v1/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bus_id: busId,
          route_id: "R-01",
          // 9.5 km along the R-01 road line -- the scripted corroboration
          // spot (see backend simulator SCRIPTED_POTHOLES).
          location: { lat: 21.006748, lng: 75.657268 },
          confidence: topDetection.confidence,
          source: "simulator",
        }),
      });
      setSubmitted(true);
      window.dispatchEvent(new CustomEvent("fleet-data-updated"));
      onEventCreated?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Event creation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ScanSearch className="h-4 w-4 text-accent-blue" />
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink">Pothole Detection</h3>
        <span className="rounded-full border border-line bg-surface-raised px-2 py-0.5 font-mono text-[9px] font-semibold uppercase text-ink-muted">
          Real YOLOv8 Weights
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {DEMO_IMAGES.map((img) => (
          <button
            key={img.url}
            type="button"
            onClick={() => pickDemoImage(img.url)}
            className={`rounded border px-2 py-1 font-mono text-[10px] font-semibold transition-colors ${
              imageUrl === img.url && !file
                ? "border-accent-blue bg-accent-blue-soft text-accent-blue"
                : "border-line bg-surface text-ink-muted hover:bg-surface-raised"
            }`}
          >
            {img.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`inline-flex items-center gap-1 rounded border px-2 py-1 font-mono text-[10px] font-semibold transition-colors ${
            file
              ? "border-accent-blue bg-accent-blue-soft text-accent-blue"
              : "border-line bg-surface text-ink-muted hover:bg-surface-raised"
          }`}
        >
          <Upload className="h-3 w-3" />
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickUpload(f);
          }}
        />
      </div>

      <div className="flex gap-2">
        {imageUrl && (
          <div className="h-24 w-32 shrink-0 overflow-hidden rounded-md border border-line bg-black">
            <img src={imageUrl} alt="Selected road image for pothole detection" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="flex flex-1 flex-col justify-center gap-1.5">
          <button
            type="button"
            onClick={runDetection}
            disabled={inferring || (!imageUrl && !file)}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-accent-blue px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-600 disabled:opacity-50"
          >
            {inferring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
            {inferring ? "Running inference..." : "Detect Potholes"}
          </button>
          <p className="text-[10px] leading-snug text-ink-faint">
            Demo Evidence — simulated fleet sensing images, not live bus-camera captures.
          </p>
        </div>
      </div>

      {topDetection && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-ink">
              Detected: <span className="font-mono">{topDetection.class_name}</span>
            </span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {(topDetection.confidence * 100).toFixed(1)}%
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-ink-muted">
            bbox: [{topDetection.bbox.map((v) => Math.round(v)).join(", ")}]
          </p>
          <button
            type="button"
            onClick={createEvent}
            disabled={submitting || submitted}
            className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-ink hover:bg-surface-raised disabled:opacity-60"
          >
            {submitted ? "✓ Sensing Event Created" : submitting ? "Creating..." : "Create Sensing Event"}
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-md border border-accent-danger/40 bg-accent-danger-soft p-2.5 text-[11px] font-medium text-accent-danger">
          {error}
        </div>
      )}
    </div>
  );
}
