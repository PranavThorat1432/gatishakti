import { useEffect, useState } from "react";
import { api } from "../services/api";
import type {
  CongestionObservation,
  Defect,
  PotholeEvent,
  Route,
  RouteSummary,
} from "../types/api";
import { LoadingState } from "../components/ui/LoadingState";
import { ErrorState } from "../components/ui/ErrorState";
import { SensingPipeline } from "../components/dashboard/SensingPipeline";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SEVERITY_COLORS = ["#dc2626", "#f59e0b", "#3b82f6"];

export function AnalyticsPage() {
  const [events, setEvents] = useState<PotholeEvent[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [congestion, setCongestion] = useState<CongestionObservation[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routeSummaries, setRouteSummaries] = useState<Record<string, RouteSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = () => {
    setLoading(true);
    setError(null);
    Promise.all([api.getEvents(), api.getDefects(), api.getCongestion(), api.getRoutes()])
      .then(async ([evt, def, cong, rte]) => {
        setEvents(evt);
        setDefects(def);
        setCongestion(cong);
        setRoutes(rte);
        // Route condition summary (P1-02): real per-route numbers.
        const summaries = await Promise.all(
          rte.map(async (r) => [r.route_id, await api.getRouteSummary(r.route_id)] as const)
        );
        setRouteSummaries(Object.fromEntries(summaries));
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load analytics data.")
      )
      .finally(() => setLoading(false));
  };

  useEffect(loadAnalytics, []);

  if (loading) return <LoadingState label="Loading urban intelligence analytics" />;

  if (error) return <ErrorState title="Analytics unavailable" description={error} onRetry={loadAnalytics} />;

  // Real values only -- the previous version fabricated fallback counts.
  const severityData = [
    { name: "High", value: events.filter((e) => e.severity === "high").length },
    { name: "Medium", value: events.filter((e) => e.severity === "medium").length },
    { name: "Low", value: events.filter((e) => e.severity === "low").length },
  ].filter((d) => d.value > 0);

  // Event trend by hour over the recorded observations (P1-01).
  const hourBuckets = new Map<string, number>();
  events.forEach((e) => {
    const d = new Date(e.created_at);
    const key = `${String(d.getHours()).padStart(2, "0")}:00`;
    hourBuckets.set(key, (hourBuckets.get(key) || 0) + 1);
  });
  const trendData = Array.from(hourBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, count]) => ({ hour, observations: count }));

  // Observation -> cluster -> confirmed funnel (P0-07 / P1-01).
  const confirmed = defects.filter((d) => d.status === "confirmed").length;
  const funnelData = [
    { stage: "Observations", count: events.length },
    { stage: "Defect Clusters", count: defects.length },
    { stage: "Confirmed", count: confirmed },
  ];

  const busMap: Record<string, number> = {};
  events.forEach((e) => {
    busMap[e.bus_id] = (busMap[e.bus_id] || 0) + 1;
  });
  const busActivityData = Object.entries(busMap).map(([busId, count]) => ({
    busId,
    detections: count,
  }));

  const routeRows = routes.map((route) => {
    const summary = routeSummaries[route.route_id];
    const hotspots = congestion.filter(
      (c) =>
        c.route_id === route.route_id &&
        c.congestion_score >= 0.6
    );
    const worst = hotspots.length
      ? Math.max(...hotspots.map((c) => c.congestion_score))
      : (congestion.filter((c) => c.route_id === route.route_id).reduce((m, c) => Math.max(m, c.congestion_score), 0));
    const condition =
      worst >= 0.75 ? "Severe" : worst >= 0.5 ? "High" : worst >= 0.25 ? "Moderate" : worst > 0 ? "Low" : "—";
    return {
      route,
      summary,
      condition,
    };
  });

  const hotspotObservations = congestion
    .filter((c) => c.congestion_score >= 0.6)
    .sort((a, b) => b.congestion_score - a.congestion_score)
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-ink">Urban Intelligence Analytics</h2>
        <p className="text-xs text-ink-muted">
          Trends, severity, corridor condition and congestion hotspots from the simulated fleet dataset
        </p>
      </div>

      <SensingPipeline />

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-xs text-ink-muted">
          No observations recorded yet. Run the demo scenario to populate analytics.
        </div>
      ) : (
        <>
          {/* Funnel: the core intelligence story (P0-07) */}
          <div className="rounded-lg border border-line bg-surface p-4 shadow-2xs">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink">
              Observations → Clusters → Confirmed
            </h3>
            <div className="grid grid-cols-3 items-center gap-2 text-center">
              {funnelData.map((f, i) => (
                <div key={f.stage} className="contents">
                  {i > 0 && <span className="text-ink-faint" aria-hidden="true">→</span>}
                  <div className="rounded-md border border-line bg-surface-raised/60 p-3">
                    <span
                      className={`block font-mono text-2xl font-bold ${
                        i === 2 ? "text-emerald-600 dark:text-emerald-400" : "text-ink"
                      }`}
                    >
                      {f.count}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                      {f.stage}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-[10px] text-ink-faint">
              Confirmation rule: same/similar location + time window + ≥ 2 unique bus IDs
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Event trend (P1-01) */}
            <div className="space-y-3 rounded-lg border border-line bg-surface p-4 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink">Event Trend (by hour)</h3>
              <div className="h-56 w-full">
                {trendData.length === 0 ? (
                  <p className="pt-16 text-center text-xs text-ink-faint">No data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="observations"
                        stroke="#2563eb"
                        fill="#2563eb"
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Severity -- real values only */}
            <div className="space-y-3 rounded-lg border border-line bg-surface p-4 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink">Defect Severity Breakdown</h3>
              <div className="h-56 w-full">
                {severityData.length === 0 ? (
                  <p className="pt-16 text-center text-xs text-ink-faint">No data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={severityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {severityData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[index % SEVERITY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Detections by bus */}
            <div className="space-y-3 rounded-lg border border-line bg-surface p-4 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink">Observations By Sensing Bus</h3>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={busActivityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="busId" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="detections" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Congestion hotspot summary (P1-01) */}
            <div className="space-y-3 rounded-lg border border-line bg-surface p-4 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink">Congestion Hotspots</h3>
              {hotspotObservations.length === 0 ? (
                <p className="py-10 text-center text-xs text-ink-faint">No hotspots above the 0.6 score threshold.</p>
              ) : (
                <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                  {hotspotObservations.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded border border-line bg-surface-raised/60 px-2.5 py-1.5 font-mono text-[11px]"
                    >
                      <span className="font-semibold text-ink">{c.route_id || "unassigned"}</span>
                      <span className="text-ink-muted">
                        {c.location.lat.toFixed(3)}, {c.location.lng.toFixed(3)}
                      </span>
                      <span
                        className={`font-bold ${
                          c.congestion_score >= 0.75
                            ? "text-red-600 dark:text-red-400"
                            : "text-orange-600 dark:text-orange-400"
                        }`}
                      >
                        {(c.congestion_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Route condition summary (P1-02) */}
          <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-2xs">
            <div className="border-b border-line bg-surface-raised px-4 py-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink">Route Condition Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-surface-raised/60 font-mono text-[10px] uppercase text-ink-faint">
                  <tr>
                    <th className="px-4 py-2.5">Route</th>
                    <th className="px-4 py-2.5">Buses</th>
                    <th className="px-4 py-2.5">Observations</th>
                    <th className="px-4 py-2.5">Defects</th>
                    <th className="px-4 py-2.5">Confirmed</th>
                    <th className="px-4 py-2.5">Congestion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {routeRows.map(({ route, summary, condition }) => (
                    <tr key={route.route_id} className="hover:bg-surface-raised/40">
                      <td className="px-4 py-2.5">
                        <span className="font-mono font-semibold text-ink">{route.route_id}</span>
                        <span className="ml-2 text-ink-muted">{route.route_name}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-ink">{summary?.buses_recorded ?? 0}</td>
                      <td className="px-4 py-2.5 font-mono text-ink">{summary?.observation_count ?? 0}</td>
                      <td className="px-4 py-2.5 font-mono text-ink">{summary?.defect_count ?? 0}</td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {summary?.confirmed_defect_count ?? 0}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            condition === "Severe"
                              ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                              : condition === "High"
                              ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
                              : condition === "Moderate"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          {condition}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
