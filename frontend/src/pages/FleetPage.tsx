import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { BusStatus, PotholeEvent, Route } from "../types/api";
import { LoadingState } from "../components/ui/LoadingState";
import { ErrorState } from "../components/ui/ErrorState";
import { EmptyState } from "../components/ui/EmptyState";
import { Bus, MapPin } from "lucide-react";

export function FleetPage() {
  const [buses, setBuses] = useState<BusStatus[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [events, setEvents] = useState<PotholeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFleet = () => {
    setLoading(true);
    setError(null);
    Promise.all([api.getBuses(), api.getRoutes(), api.getEvents()])
      .then(([b, r, e]) => {
        setBuses(b);
        setRoutes(r);
        setEvents(e);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load fleet status.")
      )
      .finally(() => setLoading(false));
  };

  useEffect(loadFleet, []);

  if (loading) return <LoadingState label="Loading fleet status" />;

  if (error) return <ErrorState title="Fleet status unavailable" description={error} onRetry={loadFleet} />;

  const routeName = (routeId?: string | null) => {
    const route = routes.find((r) => r.route_id === routeId);
    return route ? `${route.route_id} • ${route.route_name}` : null;
  };

  const lastEventFor = (busId: string) =>
    events.find((e) => e.bus_id === busId) || null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-ink">Public Transport Sensing Fleet</h2>
        <p className="text-xs text-ink-muted">
          Simulated mobile sensing units on demo municipal routes — no physical buses are connected
        </p>
      </div>

      {buses.length === 0 ? (
        <EmptyState
          icon={<Bus className="h-5 w-5" />}
          title="No fleet recorded"
          description="Run the demo scenario to seed the simulated sensing fleet."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {buses.map((bus) => {
            const lastEvent = lastEventFor(bus.bus_id);
            return (
              <div key={bus.bus_id} className="space-y-3 rounded-lg border border-line bg-surface p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-blue font-bold text-white">
                      <Bus className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-mono text-sm font-bold text-ink">{bus.bus_id}</h3>
                      <p className="font-mono text-[10px] text-ink-muted">
                        {routeName(bus.route_id) || "Route unassigned"}
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-emerald-600">
                    {bus.status}
                  </span>
                </div>

                <div className="space-y-1 rounded-md border border-line bg-surface-raised p-2.5 font-mono text-xs">
                  <div className="flex items-center justify-between text-ink-muted">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      GPS:
                    </span>
                    <span className="font-semibold text-ink">
                      {bus.location.lat.toFixed(4)}, {bus.location.lng.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between text-ink-muted">
                    <span>Last seen:</span>
                    <span className="font-medium text-ink">
                      {new Date(bus.last_seen_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex justify-between text-ink-muted">
                    <span>Last event:</span>
                    <span className="font-medium text-ink">
                      {lastEvent
                        ? `${lastEvent.event_type} • ${new Date(lastEvent.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : "—"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px]">
                  <span className="rounded bg-surface-raised px-1.5 py-0.5 font-mono font-semibold uppercase text-ink-muted">
                    source: simulator
                  </span>
                  <span className="text-ink-faint">Demo fleet data</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
