import { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";
import type { HealthStatus } from "../../types/api";
import { Play, RotateCcw, Sun, Moon, Menu } from "lucide-react";

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  onRunSimulator?: () => void;
  onResetSimulator?: () => void;
}

export function Header({ title, onMenuClick, onRunSimulator, onResetSimulator }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const data = await api.getHealth();
        if (isMounted) setHealth(data);
      } catch (err) {
        if (isMounted) setHealth(null);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleRunSim = async () => {
    if (onRunSimulator) {
      onRunSimulator();
      return;
    }
    try {
      setIsSimulating(true);
      await api.runSimulator({ bus_count: 5, events_per_bus: 3, seed_confirmed_defect: true });
      window.dispatchEvent(new CustomEvent("fleet-data-updated"));
    } catch (err) {
      console.error("Failed to run simulator:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleResetSim = async () => {
    if (onResetSimulator) {
      onResetSimulator();
      return;
    }
    if (!window.confirm("Are you sure you want to reset all demo defect and event data?")) return;
    try {
      await api.resetSimulator();
      window.dispatchEvent(new CustomEvent("fleet-data-updated"));
    } catch (err) {
      console.error("Failed to reset simulator:", err);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Toggle navigation"
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-raised md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <h1 className="text-[15px] font-semibold text-ink">{title}</h1>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="hidden items-center gap-1.5 rounded-md border border-line bg-surface-raised px-2.5 py-1 text-[11px] font-medium sm:flex">
          <span
            className={`h-2 w-2 rounded-full ${
              health?.status === "ok" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`}
          />
          {/* <span className="text-ink-muted">
            {health?.status === "ok"
              ? health.database.includes("mongomock")
                ? "MOCK DB OPERATIONAL"
                : "ATLAS DB CONNECTED"
              : "CONNECTING BACKEND..."}
          </span> */}
        </div>

        <button
          type="button"
          onClick={handleRunSim}
          disabled={isSimulating}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-blue px-2.5 py-1 text-[11px] font-medium text-white shadow-xs hover:bg-blue-600 transition-colors disabled:opacity-50"
          title="Run the deterministic simulated fleet scenario (no live buses)"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>{isSimulating ? "Simulating..." : "Run Demo Scenario"}</span>
        </button>

        <button
          type="button"
          onClick={handleResetSim}
          className="hidden items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[11px] font-medium text-ink-muted hover:bg-surface-raised hover:text-ink transition-colors md:inline-flex"
          title="Clear Demo State"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset</span>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
