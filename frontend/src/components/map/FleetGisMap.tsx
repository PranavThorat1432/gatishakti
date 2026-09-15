import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { BusStatus, CongestionObservation, Defect, Route } from "../../types/api";
import { Layers, ShieldCheck, AlertTriangle, Bus as BusIcon, Activity } from "lucide-react";

interface FleetGisMapProps {
  buses?: BusStatus[];
  defects?: Defect[];
  congestion?: CongestionObservation[];
  selectedDefectId?: string | null;
  onSelectDefect?: (defect: Defect) => void;
  onSelectBus?: (bus: BusStatus) => void;
  /** Route Intelligence (P0-03): draw the selected corridor on the map. */
  route?: Route | null;
  /** Shown when a route is active so the user can exit corridor analysis. */
  onClearRoute?: () => void;
}

// Congestion intensity tiers (P0-08). Radius AND opacity grow with
// congestion_score so the layer reads as spatial intensity, not point marks.
type CongestionTier = {
  label: string;
  color: string;
  radius: number;
  fillOpacity: number;
};

function congestionTier(score: number): CongestionTier {
  if (score >= 0.75) return { label: "Severe congestion", color: "#dc2626", radius: 400, fillOpacity: 0.45 };
  if (score >= 0.5) return { label: "High congestion", color: "#ea580c", radius: 320, fillOpacity: 0.38 };
  if (score >= 0.25) return { label: "Moderate congestion", color: "#f59e0b", radius: 240, fillOpacity: 0.3 };
  return { label: "Low congestion", color: "#3b82f6", radius: 160, fillOpacity: 0.2 };
}

function createBusIcon(busId: string) {
  return L.divIcon({
    className: "custom-leaflet-marker",
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: #2563eb; color: white; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 6v6M16 6v6M4 11h16M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"/>
          <circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>
        </svg>
        <span style="position: absolute; bottom: -8px; background: #1e293b; color: white; font-size: 8px; font-weight: 700; padding: 1px 4px; border-radius: 4px; white-space: nowrap; font-family: monospace;">${busId}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function createDefectIcon(status: "confirmed" | "unconfirmed", uniqueBusesCount: number) {
  const isConfirmed = status === "confirmed";
  const bg = isConfirmed ? "#059669" : "#d97706";
  const border = isConfirmed ? "#10b981" : "#f59e0b";

  return L.divIcon({
    className: "custom-leaflet-marker",
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; background: ${bg}; color: white; border-radius: 8px; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.25); transition: transform 0.2s;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span style="position: absolute; top: -6px; right: -6px; background: ${border}; color: white; font-size: 9px; font-weight: 800; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1.5px solid white;">${uniqueBusesCount}</span>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
}

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

/** Draws the selected route corridor and fits the map to it (P0-03). */
function RouteLayer({ route }: { route: Route }) {
  const map = useMap();
  const latLngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);

  useEffect(() => {
    if (latLngs.length < 2) return;
    try {
      map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] });
    } catch {
      // fitBounds on a degenerate line should never break the map (P1-10)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.route_id, map]);

  return (
    <>
      <Polyline positions={latLngs} pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.85 }} />
      <CircleMarker
        center={latLngs[0]}
        radius={6}
        pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#059669", fillOpacity: 1 }}
      >
        <Popup>Origin: {route.origin.name}</Popup>
      </CircleMarker>
      <CircleMarker
        center={latLngs[latLngs.length - 1]}
        radius={6}
        pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#1e293b", fillOpacity: 1 }}
      >
        <Popup>Destination: {route.destination.name}</Popup>
      </CircleMarker>
    </>
  );
}

export function FleetGisMap({
  buses = [],
  defects = [],
  congestion = [],
  onSelectDefect,
  onSelectBus,
  route = null,
  onClearRoute,
}: FleetGisMapProps) {
  const [showBuses, setShowBuses] = useState(true);
  const [showConfirmed, setShowConfirmed] = useState(true);
  const [showUnconfirmed, setShowUnconfirmed] = useState(true);
  const [showCongestion, setShowCongestion] = useState(true);

  const defaultCenter: [number, number] = [21.0, 75.5];
  const center: [number, number] =
    route && route.geometry.coordinates.length > 0
      ? [
          route.geometry.coordinates[0][1],
          route.geometry.coordinates[0][0],
        ]
      : defects.length > 0
      ? [defects[0].location.lat, defects[0].location.lng]
      : buses.length > 0
      ? [buses[0].location.lat, buses[0].location.lng]
      : defaultCenter;

  const filteredDefects = defects.filter((d) => {
    if (d.status === "confirmed" && !showConfirmed) return false;
    if (d.status === "unconfirmed" && !showUnconfirmed) return false;
    return true;
  });

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-line shadow-xs">
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface/90 p-1.5 backdrop-blur shadow-sm text-xs font-medium">
        <span className="flex items-center gap-1 px-1.5 text-ink-muted text-[11px] font-semibold">
          <Layers className="h-3.5 w-3.5 text-accent-blue" />
          <span>Layers:</span>
        </span>
        <button
          type="button"
          onClick={() => setShowBuses((v) => !v)}
          className={`flex items-center gap-1 rounded-md px-2 py-1 transition-colors ${
            showBuses ? "bg-accent-blue-soft text-accent-blue font-semibold" : "text-ink-muted hover:bg-surface-raised"
          }`}
        >
          <BusIcon className="h-3.5 w-3.5" />
          <span>Buses ({buses.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setShowConfirmed((v) => !v)}
          className={`flex items-center gap-1 rounded-md px-2 py-1 transition-colors ${
            showConfirmed ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold" : "text-ink-muted hover:bg-surface-raised"
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Confirmed ({defects.filter((d) => d.status === "confirmed").length})</span>
        </button>
        <button
          type="button"
          onClick={() => setShowUnconfirmed((v) => !v)}
          className={`flex items-center gap-1 rounded-md px-2 py-1 transition-colors ${
            showUnconfirmed ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold" : "text-ink-muted hover:bg-surface-raised"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Unconfirmed ({defects.filter((d) => d.status === "unconfirmed").length})</span>
        </button>
        <button
          type="button"
          onClick={() => setShowCongestion((v) => !v)}
          className={`flex items-center gap-1 rounded-md px-2 py-1 transition-colors ${
            showCongestion ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold" : "text-ink-muted hover:bg-surface-raised"
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Congestion ({congestion.length})</span>
        </button>
      </div>

      {route && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2 rounded-lg border border-accent-blue/40 bg-surface/95 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
          <span className="inline-block h-1 w-5 rounded-full bg-accent-blue" />
          <span className="font-semibold text-ink">{route.route_name}</span>
          {onClearRoute && (
            <button
              type="button"
              onClick={onClearRoute}
              className="rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Clear Route
            </button>
          )}
        </div>
      )}

      <div className="absolute bottom-4 left-3 z-20 hidden rounded-md border border-line bg-surface/90 px-3 py-2 text-[10px] backdrop-blur shadow-sm sm:block">
        <div className="font-semibold text-ink mb-1">GIS MAP LEGEND</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-ink-muted">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
            <span>Sensing Bus</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-accent-blue" />
            <span>Selected Route</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
            <span>Confirmed Defect</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
            <span>Unconfirmed Defect</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500/30" />
            <span>Low Congestion</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/40" />
            <span>Moderate Congestion</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-600/50" />
            <span>High Congestion</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600/60" />
            <span>Severe Congestion</span>
          </div>
        </div>
      </div>

      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
        <MapController center={center} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {route && <RouteLayer route={route} />}

        {showCongestion &&
          congestion.map((c) => {
            const tier = congestionTier(c.congestion_score);
            return (
              <Circle
                key={c.id}
                center={[c.location.lat, c.location.lng]}
                radius={tier.radius}
                pathOptions={{
                  color: tier.color,
                  fillColor: tier.color,
                  fillOpacity: tier.fillOpacity,
                  weight: 1,
                }}
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold text-ink">{tier.label}</p>
                    <p className="text-ink-muted">Bus ID: {c.bus_id}</p>
                    <p className="text-ink-muted">
                      Congestion score: {(c.congestion_score * 100).toFixed(0)}% &middot; Density:{" "}
                      {c.vehicle_density} veh
                    </p>
                  </div>
                </Popup>
              </Circle>
            );
          })}

        {showBuses &&
          buses.map((bus) => (
            <Marker
              key={bus.bus_id}
              position={[bus.location.lat, bus.location.lng]}
              icon={createBusIcon(bus.bus_id)}
              eventHandlers={{
                click: () => onSelectBus?.(bus),
              }}
            >
              <Popup>
                <div className="text-xs space-y-1">
                  <div className="font-bold text-ink flex items-center justify-between gap-2">
                    <span>{bus.bus_id}</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono">
                      {bus.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-ink-muted">Route: {bus.route_id || "—"}</p>
                  <p className="text-ink-muted font-mono text-[10px]">
                    {bus.location.lat.toFixed(4)}, {bus.location.lng.toFixed(4)}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}

        {filteredDefects.map((defect) => (
          <Marker
            key={defect.id}
            position={[defect.location.lat, defect.location.lng]}
            icon={createDefectIcon(defect.status, defect.unique_bus_ids.length)}
            eventHandlers={{
              click: () => onSelectDefect?.(defect),
            }}
          >
            <Popup>
              <div className="text-xs space-y-1.5 min-w-40">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-ink text-[11px]">
                    {defect.display_id || defect.id.toUpperCase()}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      defect.status === "confirmed"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {defect.status}
                  </span>
                </div>
                <p className="text-ink-muted">
                  Corroboration: <strong>{defect.unique_bus_ids.length} unique bus(es)</strong>
                </p>
                <p className="text-ink-muted">Total Observations: {defect.report_count}</p>
                <button
                  type="button"
                  onClick={() => onSelectDefect?.(defect)}
                  className="w-full mt-1 bg-accent-blue text-white rounded py-1 text-[11px] font-semibold hover:bg-blue-600"
                >
                  View Inspection Record
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
