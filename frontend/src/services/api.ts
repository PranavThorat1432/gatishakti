import type {
  BusStatus,
  CongestionObservation,
  DashboardSummary,
  Defect,
  DetectResponse,
  HealthStatus,
  InsightResponse,
  PotholeEvent,
  Route,
  RouteSummary,
  SimulatorRunRequest,
  SimulatorRunResult,
} from "../types/api";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  getHealth: () => request<HealthStatus>("/health"),

  getDashboardSummary: () => request<DashboardSummary>("/api/v1/dashboard/summary"),

  getEvents: () => request<PotholeEvent[]>("/api/v1/events"),

  getEventById: (id: string) => request<PotholeEvent>(`/api/v1/events/${id}`),

  getDefects: (status?: "confirmed" | "unconfirmed") => {
    const query = status ? `?status=${status}` : "";
    return request<Defect[]>(`/api/v1/defects${query}`);
  },

  getDefectById: (id: string) => request<Defect>(`/api/v1/defects/${id}`),

  getBuses: () => request<BusStatus[]>("/api/v1/buses"),

  getCongestion: () => request<CongestionObservation[]>("/api/v1/congestion"),

  getInsight: () =>
    request<InsightResponse>("/api/v1/insights", {
      method: "POST",
    }),

  // Route Intelligence (P0-04)
  getRoutes: () => request<Route[]>("/api/v1/routes"),

  getRouteById: (routeId: string) => request<Route>(`/api/v1/routes/${routeId}`),

  getRouteSummary: (routeId: string) => request<RouteSummary>(`/api/v1/routes/${routeId}/summary`),

  detectPothole: (file: File) => {
    const form = new FormData();
    form.append("image", file);
    return fetch(`${BASE_URL}/api/v1/events/detect`, { method: "POST", body: form })
      .then(async (response) => {
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(`API Error ${response.status}: ${text}`);
        }
        return response.json();
      })
      .then((data) => data as DetectResponse);
  },

  runSimulator: (params?: SimulatorRunRequest) =>
    request<SimulatorRunResult>("/api/v1/simulator/run", {
      method: "POST",
      body: JSON.stringify(params || {}),
    }),

  resetSimulator: () =>
    request<void>("/api/v1/simulator/reset", {
      method: "POST",
    }),
};
