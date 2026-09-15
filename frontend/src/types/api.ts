export type EventSeverity = "low" | "medium" | "high";
export type DefectStatus = "unconfirmed" | "confirmed";
export type BusOperationalStatus = "active" | "idle";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface DefectObservation {
  event_id?: string | null;
  bus_id: string;
  confidence: number;
  evidence_image_url?: string | null;
  observed_at: string;
}

export interface PotholeEvent {
  id: string;
  display_id?: string | null;
  bus_id: string;
  event_type: "pothole";
  route_id?: string | null;
  location: GeoPoint;
  confidence: number;
  severity: EventSeverity;
  evidence_image_url?: string | null;
  evidence_video_url?: string | null;
  source: "simulator" | "android";
  timestamp?: string | null;
  defect_id?: string | null;
  created_at: string;
  /** When the edge device claims the detection happened (may be null on
   * legacy records -- falls back to created_at). */
  observed_at?: string | null;
}

export interface Defect {
  id: string;
  display_id?: string | null;
  route_id?: string | null;
  location: GeoPoint;
  report_count: number;
  unique_bus_ids: string[];
  status: DefectStatus;
  confirmation_score: number;
  evidence_image_url?: string | null;
  observations: DefectObservation[];
  severity?: "low" | "medium" | "high" | null;
  avg_confidence?: number;
  first_seen_at: string;
  last_seen_at: string;
}

export interface BusStatus {
  bus_id: string;
  route_id?: string | null;
  location: GeoPoint;
  last_seen_at: string;
  status: BusOperationalStatus;
}

export interface CongestionObservation {
  id: string;
  bus_id: string;
  route_id?: string | null;
  location: GeoPoint;
  vehicle_density: number;
  congestion_score: number;
  source: "simulator" | "android";
  timestamp?: string | null;
  created_at: string;
  observed_at?: string | null;
}

export interface DashboardSummary {
  events_today: number;
  unconfirmed_defects: number;
  confirmed_defects: number;
  active_buses: number;
  total_defects: number;
}

export interface IntegrationsStatus {
  cloudinary: "configured" | "unavailable";
  openrouter: "configured" | "unavailable";
  pothole_model: "loaded" | "unavailable";
}

export interface HealthStatus {
  status: "ok" | "degraded";
  time: string;
  database: string;
  integrations: IntegrationsStatus;
}

export interface InsightResponse {
  available: boolean;
  insight: string;
}

// P0-10: detect-only preview from POST /api/v1/events/detect
export interface PotholeDetection {
  class_name: string;
  confidence: number;
  bbox: number[];
}

export interface DetectResponse {
  available: boolean;
  detections: PotholeDetection[];
  message: string;
}

export interface SimulatorRunRequest {
  bus_count?: number;
  events_per_bus?: number;
  seed_confirmed_defect?: boolean;
  scenario?: "demo" | "random";
  seed_evidence_images?: boolean;
  seed?: number | null;
}

export interface SimulatorRunResult {
  buses_simulated: number;
  pothole_events_created: number;
  congestion_observations_created: number;
  defects_touched: number;
}

// Route Intelligence types (P0-04)
export interface RouteOriginDest {
  name: string;
  latitude: number;
  longitude: number;
}

export interface RouteGeometry {
  type: "LineString";
  coordinates: [number, number][]; // [lng, lat] pairs
}

export interface Route {
  route_id: string;
  route_name: string;
  origin: RouteOriginDest;
  destination: RouteOriginDest;
  geometry: RouteGeometry;
  active: boolean;
  /** Road-network metadata (from the OSRM/OpenStreetMap geometry bake). */
  distance_km?: number | null;
  duration_min?: number | null;
  geometry_source?: string | null;
}

export interface RouteSummary {
  route_id: string;
  route_name: string;
  buses_recorded: number;
  observation_count: number;
  defect_count: number;
  confirmed_defect_count: number;
  unconfirmed_defect_count: number;
  congestion_hotspot_count: number;
  source: string;
}
