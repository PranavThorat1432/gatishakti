import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Defect } from "../types/api";
import { DefectDetailDrawer } from "../components/dashboard/DefectDetailDrawer";
import { LoadingState } from "../components/ui/LoadingState";
import { ErrorState } from "../components/ui/ErrorState";
import { AlertTriangle, Bus, CheckCircle2 } from "lucide-react";

export function DefectsPage() {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<"all" | "confirmed" | "unconfirmed">("all");
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);

  const loadDefects = () => {
    setLoading(true);
    setError(null);
    api
      .getDefects()
      .then(setDefects)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load road defects.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadDefects, []);

  const filtered = defects.filter((d) => statusTab === "all" || d.status === statusTab);

  if (loading) return <LoadingState label="Loading road defects inventory" />;

  if (error) {
    return (
      <ErrorState
        title="Road defects unavailable"
        description={error}
        onRetry={loadDefects}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-ink">Road Defects</h2>
          <p className="text-xs text-ink-muted">
            One bus report is an observation. Independent reports from 2+ unique buses confirm a defect
            (25 m radius / 30 min window) &middot; simulated fleet data
          </p>
        </div>

        <div className="flex rounded-md border border-line bg-surface p-1 text-xs">
          <button
            type="button"
            onClick={() => setStatusTab("all")}
            className={`rounded px-3 py-1 font-medium transition-colors ${
              statusTab === "all" ? "bg-accent-blue text-white font-semibold" : "text-ink-muted hover:text-ink"
            }`}
          >
            All ({defects.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab("confirmed")}
            className={`rounded px-3 py-1 font-medium transition-colors ${
              statusTab === "confirmed" ? "bg-emerald-600 text-white font-semibold" : "text-ink-muted hover:text-ink"
            }`}
          >
            Confirmed ({defects.filter((d) => d.status === "confirmed").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab("unconfirmed")}
            className={`rounded px-3 py-1 font-medium transition-colors ${
              statusTab === "unconfirmed" ? "bg-amber-600 text-white font-semibold" : "text-ink-muted hover:text-ink"
            }`}
          >
            Unconfirmed ({defects.filter((d) => d.status === "unconfirmed").length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((defect) => {
          const isConfirmed = defect.status === "confirmed";
          return (
            <div
              key={defect.id}
              onClick={() => setSelectedDefect(defect)}
              className="cursor-pointer rounded-lg border border-line bg-surface p-4 shadow-2xs transition-all hover:border-accent-blue/50 hover:shadow-md space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-ink">{defect.display_id || defect.id.toUpperCase()}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    isConfirmed
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  {isConfirmed ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {defect.status}
                </span>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-ink-muted mb-1 font-medium">
                  <span>Prototype Confirmation Score</span>
                  <span className="font-mono font-bold text-ink">
                    {Math.round(defect.confirmation_score * 100)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
                  <div
                    className={`h-full ${isConfirmed ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{ width: `${Math.round(defect.confirmation_score * 100)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-ink-muted font-medium block">Reporting Buses:</span>
                <div className="flex flex-wrap gap-1">
                  {defect.unique_bus_ids.map((busId) => (
                    <span
                      key={busId}
                      className="inline-flex items-center gap-1 rounded border border-line bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-ink font-semibold"
                    >
                      <Bus className="h-2.5 w-2.5 text-accent-blue" />
                      {busId}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-line pt-2 flex items-center justify-between text-[10px] text-ink-faint font-mono">
                <span>
                  {defect.location.lat.toFixed(4)}, {defect.location.lng.toFixed(4)}
                </span>
                <span>{defect.report_count} Observations</span>
              </div>
            </div>
          );
        })}
      </div>

      <DefectDetailDrawer defect={selectedDefect} onClose={() => setSelectedDefect(null)} />
    </div>
  );
}
