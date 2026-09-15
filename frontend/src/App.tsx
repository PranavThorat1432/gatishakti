import { Routes, Route } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { MapPage } from "./pages/MapPage";
import { EventsPage } from "./pages/EventsPage";
import { DefectsPage } from "./pages/DefectsPage";
import { FleetPage } from "./pages/FleetPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { RouteIntelligencePage } from "./pages/RouteIntelligencePage";
import { NotFound } from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/defects" element={<DefectsPage />} />
        <Route path="/routes" element={<RouteIntelligencePage />} />
        <Route path="/fleet" element={<FleetPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/congestion" element={<AnalyticsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
