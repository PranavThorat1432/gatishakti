import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { BusStatus, CongestionObservation, Defect, Route } from "../types/api";
import { FleetGisMap } from "../components/map/FleetGisMap";
import { DefectDetailDrawer } from "../components/dashboard/DefectDetailDrawer";
import { LoadingState } from "../components/ui/LoadingState";
import { ErrorState } from "../components/ui/ErrorState";
import { Route as RouteIcon } from "lucide-react";

export function MapPage() {
  const [buses, setBuses] = useState<BusStatus[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [congestion, setCongestion] = useState<CongestionObservation[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [activeRouteId, setActiveRouteId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMapData = () => {
    setLoading(true);
    setError(null);
    Promise.all([api.getBuses(), api.getDefects(), api.getCongestion(), api.getRoutes()])
      .then(([b, d, c, r]) => {
        setBuses(b);
        setDefects(d);
        setCongestion(c);
        setRoutes(r);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load map data.")
      )
      .finally(() => setLoading(false));
  };

  useEffect(loadMapData, []);

  if (loading) return <LoadingState label="Loading full-screen GIS map" />;

  if (error) {
    return <ErrorState title="Map data unavailable" description={error} onRetry={loadMapData} />;
  }

  const activeRoute = routes.find((r) => r.route_id === activeRouteId) || null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 shadow-2xs">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <RouteIcon className="h-3.5 w-3.5 text-accent-blue" />
          Show corridor:
        </span>
        <select
          value={activeRouteId}
          onChange={(e) => setActiveRouteId(e.target.value)}
          className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink focus:border-accent-blue focus:outline-none"
        >
          <option value="">No route overlay</option>
          {routes.map((r) => (
            <option key={r.route_id} value={r.route_id}>
              {r.route_name} ({r.route_id})
            </option>
          ))}
        </select>
        <span className="text-[10px] text-ink-faint">
          Draws the road-network route line over fleet observations
        </span>
      </div>

      <div className="relative h-[calc(100vh-9.5rem)] w-full overflow-hidden rounded-lg border border-line">
        <FleetGisMap
          buses={buses}
          defects={defects}
          congestion={congestion}
          route={activeRoute}
          onClearRoute={() => setActiveRouteId("")}
          selectedDefectId={selectedDefect?.id}
          onSelectDefect={(d) => setSelectedDefect(d)}
        />
        <DefectDetailDrawer defect={selectedDefect} onClose={() => setSelectedDefect(null)} />
      </div>
    </div>
  );
}
