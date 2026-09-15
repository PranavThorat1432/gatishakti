import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/map": "Fleet map",
  "/events": "Events",
  "/defects": "Road Defects",
  "/routes": "Route Intelligence",
  "/congestion": "Congestion",
};

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const title = TITLES[location.pathname] ?? "GatiShakti Road Intelligence";

  return (
    <div className="flex h-full bg-canvas">
      <Sidebar mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header title={title} onMenuClick={() => setMobileOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
