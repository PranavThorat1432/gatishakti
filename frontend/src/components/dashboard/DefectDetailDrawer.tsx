import { useState } from "react";
import type { Defect } from "../../types/api";
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Bus,
  MapPin,
  Clock,
  Camera,
  CheckCircle2,
  ImageIcon,
} from "lucide-react";

interface DefectDetailDrawerProps {
  defect: Defect | null;
  onClose: () => void;
}

function EvidenceImage({ defect }: { defect: Defect }) {
  const [failed, setFailed] = useState(false);
  const url = defect.evidence_image_url;

  if (!url || failed) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface-raised p-6 text-center">
        <Camera className="mb-2 h-8 w-8 text-ink-faint" />
        <p className="font-semibold text-ink">Evidence media unavailable</p>
        <p className="mt-1 max-w-xs text-[10px] text-ink-muted">
          {url
            ? "The evidence image could not be loaded. The observation record itself is unaffected."
            : "This observation was reported directly without an uploaded photo. Events submitted with an image (edge client or Cloudinary upload) carry visual evidence here."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-black">
      <img
        src={url}
        alt={`Pothole detection evidence for ${defect.display_id || defect.id}`}
        onError={() => setFailed(true)}
        className="h-48 w-full object-cover"
      />
      <div className="flex items-center justify-between bg-surface-raised p-2 font-mono text-[10px] text-ink-muted">
        <span>Demo Evidence &middot; Simulated Fleet Sensing</span>
        <span>YOLOv8 Detection</span>
      </div>
    </div>
  );
}

export function DefectDetailDrawer({ defect, onClose }: DefectDetailDrawerProps) {
  if (!defect) return null;

  const isConfirmed = defect.status === "confirmed";
  const scorePercent = Math.round(defect.confirmation_score * 100);
  const observations = [...(defect.observations || [])].sort(
    (a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime()
  );

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-surface shadow-2xl transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line bg-surface-raised px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-md text-white font-bold ${
              isConfirmed ? "bg-emerald-600" : "bg-amber-500"
            }`}
          >
            {isConfirmed ? <ShieldCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="font-mono text-sm font-bold tracking-tight text-ink">
              {defect.display_id || defect.id.toUpperCase()}
            </h2>
            <p className="text-[11px] font-medium text-ink-muted">
              Pothole &middot; <span className="uppercase">{defect.status}</span>
              {defect.route_id ? ` &middot; ${defect.route_id}` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close defect details"
          className="rounded-md p-1 text-ink-muted hover:bg-line hover:text-ink transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 space-y-5 overflow-y-auto p-5 text-xs">
        {/* Status & Confirmation Score */}
        <div className="space-y-3 rounded-lg border border-line bg-surface-raised/50 p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-ink-muted">Verification Status:</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide ${
                isConfirmed
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400"
              }`}
            >
              {isConfirmed ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {defect.status}
            </span>
          </div>

          {/* Fusion Score Bar */}
          <div>
            <div className="mb-1 flex justify-between text-[11px]">
              <span className="font-medium text-ink-muted">Prototype Confirmation Score:</span>
              <span className="font-mono font-bold text-ink">{scorePercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-line">
              <div
                className={`h-full transition-all duration-500 ${
                  isConfirmed ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(100, Math.max(5, scorePercent))}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-ink-faint">
              Confirmation rule: same/similar location + time window + &ge; 2 unique bus IDs. The
              score is a prototype heuristic &mdash; the unique-bus rule is what confirms a defect.
            </p>
          </div>
        </div>

        {/* Independent Buses Corroboration */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-semibold text-ink">
              <Bus className="h-4 w-4 text-accent-blue" />
              <span>Independent Sensing Buses</span>
            </span>
            <span className="rounded bg-accent-blue-soft px-2 py-0.5 font-mono text-[11px] font-bold text-accent-blue">
              {defect.unique_bus_ids.length} Bus{defect.unique_bus_ids.length !== 1 ? "es" : ""}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {defect.unique_bus_ids.map((busId) => (
              <span
                key={busId}
                className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1 font-mono text-[11px] font-semibold text-ink"
              >
                <Bus className="h-3 w-3 text-accent-blue" />
                {busId}
              </span>
            ))}
          </div>
          <p className="pt-0.5 text-[10px] leading-relaxed text-ink-faint">
            {isConfirmed
              ? "✓ Confirmed via multi-bus spatial-temporal fusion (2+ unique buses)."
              : "⏳ Unconfirmed (requires corroboration from at least 1 more unique bus)."}
          </p>
        </div>

        {/* Observation log: the story behind the cluster */}
        {observations.length > 0 && (
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5 font-semibold text-ink">
              <Clock className="h-4 w-4 text-accent-blue" />
              <span>Observation Log ({observations.length})</span>
            </span>
            <div className="overflow-hidden rounded-md border border-line">
              {observations.map((obs, idx) => (
                <div
                  key={`${obs.event_id || obs.bus_id}-${idx}`}
                  className={`flex items-center justify-between bg-surface-raised/60 px-2.5 py-1.5 font-mono text-[10px] ${
                    idx > 0 ? "border-t border-line" : ""
                  }`}
                >
                  <span className="font-semibold text-ink">{obs.bus_id}</span>
                  <span className="text-ink-muted">
                    {new Date(obs.observed_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="font-bold text-accent-blue">
                    {(obs.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Location & GIS Coordinates */}
        <div className="space-y-1.5">
          <span className="flex items-center gap-1.5 font-semibold text-ink">
            <MapPin className="h-4 w-4 text-accent-blue" />
            <span>GPS Location Coordinates</span>
          </span>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-line bg-surface-raised p-2">
              <span className="block text-[10px] text-ink-faint">LATITUDE</span>
              <span className="font-mono text-xs font-semibold text-ink">
                {defect.location.lat.toFixed(6)}
              </span>
            </div>
            <div className="rounded-md border border-line bg-surface-raised p-2">
              <span className="block text-[10px] text-ink-faint">LONGITUDE</span>
              <span className="font-mono text-xs font-semibold text-ink">
                {defect.location.lng.toFixed(6)}
              </span>
            </div>
          </div>
        </div>

        {/* Timestamps */}
        <div className="space-y-1.5">
          <span className="flex items-center gap-1.5 font-semibold text-ink">
            <Clock className="h-4 w-4 text-accent-blue" />
            <span>Temporal Tracking</span>
          </span>
          <div className="space-y-1 rounded-md border border-line bg-surface-raised p-3 text-[11px]">
            <div className="flex justify-between">
              <span className="text-ink-muted">First Sighted:</span>
              <span className="font-mono font-medium text-ink">
                {new Date(defect.first_seen_at).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Most Recent Observation:</span>
              <span className="font-mono font-medium text-ink">
                {new Date(defect.last_seen_at).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Total Observations:</span>
              <span className="font-mono font-bold text-ink">{defect.report_count}</span>
            </div>
          </div>
        </div>

        {/* Evidence Image + metadata (P0-09 / P1-07) */}
        <div className="space-y-2">
          <span className="flex items-center gap-1.5 font-semibold text-ink">
            <Camera className="h-4 w-4 text-accent-blue" />
            <span>Computer Vision Evidence</span>
            <ImageIcon className="h-3 w-3 text-ink-faint" />
          </span>
          <EvidenceImage defect={defect} />
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface-raised/50 p-2.5 text-[10px]">
            <div>
              <span className="block text-ink-faint">Detection Class</span>
              <span className="font-mono font-semibold text-ink">Pothole</span>
            </div>
            <div>
              <span className="block text-ink-faint">AI Confidence</span>
              <span className="font-mono font-semibold text-ink">
                {defect.avg_confidence != null
                  ? `${Math.round(defect.avg_confidence * 100)}%`
                  : "—"}
              </span>
            </div>
            <div>
              <span className="block text-ink-faint">Detection Timestamp</span>
              <span className="font-mono font-semibold text-ink">
                {defect.last_seen_at ? new Date(defect.last_seen_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
              </span>
            </div>
            <div>
              <span className="block text-ink-faint">Source</span>
              <span className="font-mono font-semibold text-ink uppercase">simulator</span>
            </div>
            <div>
              <span className="block text-ink-faint">Defect ID</span>
              <span className="font-mono font-semibold text-ink">
                {defect.display_id || defect.id}
              </span>
            </div>
            <div>
              <span className="block text-ink-faint">Event Ref (internal)</span>
              <span className="font-mono font-semibold text-ink">
                {observations[observations.length - 1]?.event_id
                  ? observations[observations.length - 1].event_id
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
