import { useEffect, useState, useCallback } from "react";
import { api } from "../services/api";
import type { BusStatus, CongestionObservation, DashboardSummary, Defect, PotholeEvent } from "../types/api";
import { FleetGisMap } from "../components/map/FleetGisMap";
import { DefectDetailDrawer } from "../components/dashboard/DefectDetailDrawer";
import { SimulatorControlModal } from "../components/dashboard/SimulatorControlModal";
import { VisionDemo } from "../components/dashboard/VisionDemo";
import { LoadingState } from "../components/ui/LoadingState";
import { ErrorState } from "../components/ui/ErrorState";
import { Bus, ShieldCheck, AlertTriangle, Activity, Sparkles, Play, RefreshCw, Layers } from "lucide-react";

export function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [buses, setBuses] = useState<BusStatus[]>([]);
  const [events, setEvents] = useState<PotholeEvent[]>([]);
  const [congestion, setCongestion] = useState<CongestionObservation[]>([]);
  const [insight, setInsight] = useState<string | null>(null);

  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [sumRes, defRes, busRes, evtRes, congRes] = await Promise.all([
        api.getDashboardSummary(),
        api.getDefects(),
        api.getBuses(),
        api.getEvents(),
        api.getCongestion(),
      ]);

      setSummary(sumRes);
      setDefects(defRes);
      setBuses(busRes);
      setEvents(evtRes);
      setCongestion(congRes);

      api
        .getInsight()
        .then((res) => setInsight(res.insight))
        .catch(() => setInsight("Urban insights unavailable. Core monitoring remains operational."));
    } catch (err: any) {
      console.error("Dashboard error:", err);
      setError(err.message || "Failed to connect to FastAPI backend");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener("fleet-data-updated", handleUpdate);
    const interval = setInterval(loadData, 20000);
    return () => {
      window.removeEventListener("fleet-data-updated", handleUpdate);
      clearInterval(interval);
    };
  }, [loadData]);

  if (isLoading && !summary) {
    return <LoadingState label="Connecting to SIH26124 FastAPI backend & loading fleet GIS data" />;
  }

  if (error && !summary) {
    return (
      <ErrorState
        title="Backend Connection Offline"
        description="Could not connect to FastAPI at http://localhost:8000. Please ensure the backend server is running."
        onRetry={loadData}
      />
    );
  }

  return (
    <div className="space-y-5">
      {insight && (
        <div className="flex items-center gap-3 rounded-lg border border-accent-blue/30 bg-accent-blue-soft/50 p-3 text-xs text-ink shadow-2xs">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-blue text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1 leading-snug">
            <span className="font-bold text-accent-blue uppercase tracking-wider text-[10px] block">
              Urban Operations Summary
            </span>
            <span className="font-medium">{insight}</span>
          </div>
          <button
            type="button"
            onClick={loadData}
            title="Refresh Data"
            className="p-1 text-ink-muted hover:text-ink transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
        <div className="rounded-lg border border-line bg-surface p-4 shadow-2xs transition-all hover:border-accent-blue/40">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Active Buses</span>
            <Bus className="h-4 w-4 text-accent-blue" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-ink">{summary?.active_buses ?? 0}</span>
            <span className="text-[10px] text-ink-muted">Sensing Fleet</span>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-surface p-4 shadow-2xs transition-all hover:border-accent-blue/40">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Observations Today</span>
            <Activity className="h-4 w-4 text-accent-blue" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-ink">{summary?.events_today ?? 0}</span>
            <span className="text-[10px] text-ink-muted">Raw Sensing Reports</span>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-surface p-4 shadow-2xs transition-all hover:border-emerald-500/40">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Confirmed Defects</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {summary?.confirmed_defects ?? 0}
            </span>
            <span className="text-[10px] text-emerald-600/80 font-medium">Multi-Bus Corroborated</span>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-surface p-4 shadow-2xs transition-all hover:border-amber-500/40">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Unconfirmed</span>
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-amber-600 dark:text-amber-400">
              {summary?.unconfirmed_defects ?? 0}
            </span>
            <span className="text-[10px] text-amber-600/80 font-medium">Pending 2nd Report</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="h-[520px] lg:col-span-8 flex flex-col rounded-lg border border-line bg-surface shadow-2xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-line bg-surface-raised px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-accent-blue" />
              <h2 className="text-xs font-bold text-ink uppercase tracking-wide">
                Fleet Sensing & Defect GIS Map
              </h2>
              <span
                className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400"
                title="All fleet data on this map is generated by the built-in demo simulator."
              >
                Demo Mode • Representative Data
              </span>
            </div>
            <span className="font-mono text-[10px] text-ink-muted">
              {defects.length} Defects &middot; {buses.length} Buses
            </span>
          </div>
          <div className="flex-1 relative">
            <FleetGisMap
              buses={buses}
              defects={defects}
              congestion={congestion}
              selectedDefectId={selectedDefect?.id}
              onSelectDefect={(d) => setSelectedDefect(d)}
            />
          </div>
        </div>

        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-lg border border-line bg-surface p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-ink uppercase tracking-wide">Demo Control Center</h3>
              <span className="text-[10px] font-mono text-ink-faint"></span>
            </div>
            <p className="text-[11px] text-ink-muted mb-3 leading-relaxed">
              Run simulated bus passes across demo routes to demonstrate multi-bus spatial-temporal fusion. No real buses are connected — all data is representative.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsSimModalOpen(true)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-accent-blue px-3 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-blue-600 transition-colors"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Run Simulated Bus Passes</span>
              </button>
            </div>
            {/* <ul className="space-y-1 font-mono text-[10px] text-ink-faint">
              <li>• Seed Demo Fleet &middot; simulate pothole + corroboration</li>
              <li>• Simulate Congestion on demo routes</li>
              <li>• Reset Demo Data (confirmation required)</li>
            </ul> */}
          </div>

          <div className="rounded-lg border border-line bg-surface p-4 shadow-2xs">
            <VisionDemo onEventCreated={loadData} />
          </div>

          <div className="rounded-lg border border-line bg-surface p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h3 className="text-xs font-bold text-ink uppercase tracking-wide">Recent Observations</h3>
              <span className="font-mono text-[10px] text-accent-blue font-semibold">
                {events.length} Total
              </span>
            </div>

            <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
              {events.length === 0 ? (
                <p className="text-xs text-ink-faint text-center py-6">No observations recorded yet.</p>
              ) : (
                events.slice(0, 6).map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-center justify-between rounded-md border border-line bg-surface-raised/60 p-2 text-xs transition-colors hover:bg-surface-raised"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-mono font-semibold text-ink">
                        <Bus className="h-3 w-3 text-accent-blue" />
                        <span>{evt.bus_id}</span>
                        <span className="text-[10px] text-ink-faint">({evt.severity.toUpperCase()})</span>
                      </div>
                      <p className="font-mono text-[10px] text-ink-muted">
                        Lat: {evt.location.lat.toFixed(5)}, Lng: {evt.location.lng.toFixed(5)}
                      </p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <span className="font-mono font-bold text-accent-blue block text-[11px]">
                        {(evt.confidence * 100).toFixed(0)}% Conf
                      </span>
                      <span
                        className="text-[9px] text-ink-faint block"
                        title="Detected at (edge clock) — hover the Events page for ingestion time"
                      >
                        {new Date(evt.observed_at || evt.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <DefectDetailDrawer defect={selectedDefect} onClose={() => setSelectedDefect(null)} />

      <SimulatorControlModal
        isOpen={isSimModalOpen}
        onClose={() => setIsSimModalOpen(false)}
        onSuccess={() => {
          setIsSimModalOpen(false);
          loadData();
        }}
      />
    </div>
  );
}
