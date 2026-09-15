import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import type {
  BusStatus,
  CongestionObservation,
  Defect,
  Route,
  RouteSummary,
} from "../types/api";
import { FleetGisMap } from "../components/map/FleetGisMap";
import { DefectDetailDrawer } from "../components/dashboard/DefectDetailDrawer";
import { LoadingState } from "../components/ui/LoadingState";
import { ErrorState } from "../components/ui/ErrorState";
import { EmptyState } from "../components/ui/EmptyState";
import {
  AlertTriangle,
  ArrowRight,
  Bus,
  CheckCircle2,
  Crosshair,
  Eye,
  Flag,
  Route as RouteIcon,
  ShieldCheck,
  Activity,
} from "lucide-react";

export function RouteIntelligencePage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [routesError, setRoutesError] = useState<string | null>(null);

  const [from, setFrom] = useState("Jalgaon");
  const [to, setTo] = useState("Bhusawal");

  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [summary, setSummary] = useState<RouteSummary | null>(null);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [buses, setBuses] = useState<BusStatus[]>([]);
  const [congestion, setCongestion] = useState<CongestionObservation[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);

  const loadRoutes = useCallback(() => {
    setRoutesLoading(true);
    setRoutesError(null);
    api
      .getRoutes()
      .then((list) => {
        setRoutes(list);
        // Keep the PRD demo corridor as the default selection when present.
        if (!list.some((r) => r.origin.name === from && r.destination.name === to)) {
          const r01 = list.find((r) => r.route_id === "R-01");
          if (r01) {
            setFrom(r01.origin.name);
            setTo(r01.destination.name);
          }
        }
      })
      .catch((err: unknown) =>
        setRoutesError(err instanceof Error ? err.message : "Failed to load the demo route catalog.")
      )
      .finally(() => setRoutesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(loadRoutes, [loadRoutes]);

  const originNames = useMemo(
    () => Array.from(new Set(routes.map((r) => r.origin.name))),
    [routes]
  );
  const destinationNames = useMemo(
    () => Array.from(new Set(routes.map((r) => r.destination.name))),
    [routes]
  );

  const loadCorridor = useCallback((route: Route) => {
    setAnalyzing(true);
    setAnalysisError(null);
    Promise.all([api.getRouteSummary(route.route_id), api.getDefects(), api.getBuses(), api.getCongestion()])
      .then(([sum, allDefects, allBuses, allCongestion]) => {
        setSummary(sum);
        // P0-06 MVP rule: association is by route_id. Legacy records
        // without one are route-unassigned and excluded here only.
        setDefects(allDefects.filter((d) => d.route_id === route.route_id));
        setBuses(allBuses.filter((b) => b.route_id === route.route_id));
        setCongestion(allCongestion.filter((c) => c.route_id === route.route_id));
      })
      .catch((err: unknown) =>
        setAnalysisError(err instanceof Error ? err.message : "Failed to analyze this route.")
      )
      .finally(() => setAnalyzing(false));
  }, []);

  const handleAnalyze = () => {
    const match = routes.find((r) => r.origin.name === from && r.destination.name === to);
    if (!match) {
      setAnalysisError("Route not available in demo dataset.");
      setActiveRoute(null);
      setSummary(null);
      setDefects([]);
      setBuses([]);
      setCongestion([]);
      return;
    }
    setActiveRoute(match);
    setSelectedDefect(null);
    loadCorridor(match);
  };

  const handleClearRoute = () => {
    setActiveRoute(null);
    setSummary(null);
    setDefects([]);
    setBuses([]);
    setCongestion([]);
    setAnalysisError(null);
    setSelectedDefect(null);
  };

  if (routesLoading) {
    return <LoadingState label="Loading demo route catalog" />;
  }

  if (routesError) {
    return <ErrorState title="Route catalog unavailable" description={routesError} onRetry={loadRoutes} />;
  }

  return (
    <div className="space-y-4">
      {/* Entry point (PRD 8.1) */}
      <div className="rounded-lg border border-line bg-surface p-4 shadow-2xs">
        <div className="flex items-center gap-2 mb-3">
          <RouteIcon className="h-4 w-4 text-accent-blue" />
          <h2 className="text-base font-bold text-ink">Route Intelligence</h2>
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Demo Mode • Representative Data
          </span>
        </div>
        <p className="text-xs text-ink-muted mb-3">
          Corridor analysis over the demo route catalog — geometry follows the actual road network
          between the two towns (OpenStreetMap), with recorded fleet observations along it.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-xs font-medium text-ink-muted">
            From
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink focus:border-accent-blue focus:outline-none"
            >
              {originNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <ArrowRight className="hidden h-3.5 w-3.5 text-ink-faint sm:block" />
          <label className="flex items-center gap-2 text-xs font-medium text-ink-muted">
            To
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink focus:border-accent-blue focus:outline-none"
            >
              {destinationNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 sm:ml-2">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent-blue px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              <Crosshair className="h-3.5 w-3.5" />
              {analyzing ? "Analyzing..." : "Analyze Route"}
            </button>
            {activeRoute && (
              <button
                type="button"
                onClick={handleClearRoute}
                className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-surface-raised hover:text-ink transition-colors"
              >
                Clear Route
              </button>
            )}
          </div>
        </div>
      </div>

      {analysisError && (
        <div
          role="alert"
          className="rounded-lg border border-accent-danger/40 bg-accent-danger-soft px-4 py-3 text-xs font-medium text-accent-danger"
        >
          {analysisError}
        </div>
      )}

      {!activeRoute && !analysisError && (
        <EmptyState
          icon={<RouteIcon className="h-5 w-5" />}
          title="No route analyzed yet"
          description="Pick an origin and destination above, then Analyze Route to see recorded buses, road defects and congestion along the corridor."
        />
      )}

      {activeRoute && analyzing && !summary && <LoadingState label="Analyzing corridor" />}

      {activeRoute && summary && (
        <>
          {/* Active route state (PRD 8.2) */}
          <div className="flex flex-col gap-2 rounded-lg border border-accent-blue/40 bg-accent-blue-soft/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-accent-blue">
                Analyzing Route
              </p>
              <p className="text-sm font-bold text-ink">
                {activeRoute.route_name}
                <span className="ml-2 font-mono text-[10px] font-medium text-ink-muted">
                  {activeRoute.route_id}
                </span>
              </p>
            </div>
            <p className="text-[11px] text-ink-muted">
              {activeRoute.distance_km != null
                ? `${activeRoute.distance_km} km along the road network${
                    activeRoute.duration_min != null ? ` · ~${activeRoute.duration_min} min drive` : ""
                  } · `
                : ""}
              Simulated fleet passes recorded today · source: {summary.source}
            </p>
          </div>

          {/* Route KPIs (PRD 8.3) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Buses Recorded", value: summary.buses_recorded, icon: Bus, tone: "text-accent-blue" },
              { label: "Observations", value: summary.observation_count, icon: Eye, tone: "text-ink" },
              { label: "Road Defects", value: summary.defect_count, icon: AlertTriangle, tone: "text-ink" },
              {
                label: "Confirmed",
                value: summary.confirmed_defect_count,
                icon: ShieldCheck,
                tone: "text-emerald-600 dark:text-emerald-400",
              },
              {
                label: "Unconfirmed",
                value: summary.unconfirmed_defect_count,
                icon: Flag,
                tone: "text-amber-600 dark:text-amber-400",
              },
              {
                label: "Congestion Hotspots",
                value: summary.congestion_hotspot_count,
                icon: Activity,
                tone: "text-orange-600 dark:text-orange-400",
              },
            ].map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="rounded-lg border border-line bg-surface p-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                    {label}
                  </span>
                  <Icon className={`h-3.5 w-3.5 ${tone}`} />
                </div>
                <span className={`mt-1 block font-mono text-xl font-bold ${tone}`}>{value}</span>
              </div>
            ))}
          </div>

          {/* Observation -> cluster -> confirmation story (P0-07) */}
          <div className="rounded-lg border border-line bg-surface p-3 shadow-2xs">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center text-xs">
              <div>
                <span className="block font-mono text-lg font-bold text-ink">{summary.observation_count}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Sensing Observations
                </span>
              </div>
              <span className="text-ink-faint" aria-hidden="true">↓</span>
              <div>
                <span className="block font-mono text-lg font-bold text-ink">{summary.defect_count}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Geospatial Defect Clusters
                </span>
              </div>
              <span className="text-ink-faint" aria-hidden="true">↓</span>
              <div>
                <span className="block font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {summary.confirmed_defect_count}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Confirmed Road Defects
                </span>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-ink-faint">
              Confirmation rule: same/similar location + time window + ≥ 2 unique bus IDs
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="h-[480px] lg:col-span-8 flex flex-col rounded-lg border border-line bg-surface shadow-2xs overflow-hidden">
              <FleetGisMap
                buses={buses}
                defects={defects}
                congestion={congestion}
                route={activeRoute}
                onClearRoute={handleClearRoute}
                selectedDefectId={selectedDefect?.id}
                onSelectDefect={(d) => setSelectedDefect(d)}
              />
            </div>

            {/* Route pothole list (PRD 8.4) */}
            <div className="rounded-lg border border-line bg-surface p-4 shadow-2xs lg:col-span-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink">
                Potholes Along Route
              </h3>
              {defects.length === 0 ? (
                <p className="py-6 text-center text-xs text-ink-faint">
                  No road defects recorded on this corridor yet.
                </p>
              ) : (
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {defects.map((defect) => {
                    const isConfirmed = defect.status === "confirmed";
                    return (
                      <button
                        key={defect.id}
                        type="button"
                        onClick={() => setSelectedDefect(defect)}
                        className={`w-full rounded-md border p-2.5 text-left transition-colors ${
                          selectedDefect?.id === defect.id
                            ? "border-accent-blue bg-accent-blue-soft/50"
                            : "border-line bg-surface-raised/60 hover:bg-surface-raised"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-ink">
                            {defect.display_id || defect.id.toUpperCase()}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                              isConfirmed
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {isConfirmed ? (
                              <CheckCircle2 className="h-2.5 w-2.5" />
                            ) : (
                              <AlertTriangle className="h-2.5 w-2.5" />
                            )}
                            {defect.status}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-ink-muted">
                          <span className="uppercase font-semibold">
                            {defect.severity ? `${defect.severity} severity` : "Pothole"}
                          </span>
                          <span className="font-mono">
                            {defect.unique_bus_ids.length} bus
                            {defect.unique_bus_ids.length !== 1 ? "es" : ""}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <DefectDetailDrawer defect={selectedDefect} onClose={() => setSelectedDefect(null)} />
    </div>
  );
}
