import { NavLink } from "react-router-dom";
import { LayoutDashboard, MapPin, ClipboardList, AlertTriangle, Bus, BarChart3, ShieldCheck, Route as RouteIcon } from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    to: "/map",
    label: "Fleet GIS Map",
    icon: <MapPin className="h-4 w-4" />,
  },
  {
    to: "/events",
    label: "Events Log",
    icon: <ClipboardList className="h-4 w-4" />,
  },  {
    to: "/defects",
    label: "Road Defects",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  {
    to: "/routes",
    label: "Route Intelligence",
    icon: <RouteIcon className="h-4 w-4" />,
  }, 
  {
    to: "/fleet",
    label: "Fleet Status",
    icon: <Bus className="h-4 w-4" />,
  },
  {
    to: "/analytics",
    label: "Analytics",
    icon: <BarChart3 className="h-4 w-4" />,
  },
];

export function Sidebar({ mobileOpen, onNavigate }: { mobileOpen: boolean; onNavigate: () => void }) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-line bg-surface transition-transform duration-200 md:static md:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-blue text-white shadow-xs">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-[13px] font-bold tracking-tight text-ink">GatiShakti</p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Road Intelligence
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
          Navigation
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-accent-blue-soft text-accent-blue font-semibold"
                  : "text-ink-muted hover:bg-surface-raised hover:text-ink"
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line p-3 bg-surface-raised/50">
        <div className="rounded-md border border-line bg-surface p-2.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-ink">
            <span>Multi-Bus Fusion</span>
            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              ACTIVE
            </span>
          </div>
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink-muted">
            Radius: 25m &middot; Window: 30m<br />
            Min unique buses: 2
          </p>
        </div>
        <p className="mt-2 text-center font-mono text-[9px] text-ink-faint">
          Road Intelligence Platform
        </p>
      </div>
    </aside>
  );
}
