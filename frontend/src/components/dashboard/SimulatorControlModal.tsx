import { useState } from "react";
import { api } from "../../services/api";
import { X, Play, RotateCcw, Sliders, CheckCircle2 } from "lucide-react";

interface SimulatorControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SimulatorControlModal({ isOpen, onClose, onSuccess }: SimulatorControlModalProps) {
  const [scenario, setScenario] = useState<"demo" | "random">("demo");
  const [busCount, setBusCount] = useState(4);
  const [eventsPerBus, setEventsPerBus] = useState(3);
  const [seedConfirmed, setSeedConfirmed] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRun = async () => {
    try {
      setIsLoading(true);
      setResultMsg(null);
      const res =
        scenario === "demo"
          ? await api.runSimulator({ scenario: "demo" })
          : await api.runSimulator({
              scenario: "random",
              bus_count: busCount,
              events_per_bus: eventsPerBus,
              seed_confirmed_defect: seedConfirmed,
            });
      setResultMsg(
        scenario === "demo"
          ? `Demo scenario complete: ${res.buses_simulated} buses, ${res.pothole_events_created} pothole observations, ${res.defects_touched} defect clusters (BUS_001–003 corroborate one confirmed defect).`
          : `Success! Simulated ${res.buses_simulated} buses, created ${res.pothole_events_created} pothole events and touched ${res.defects_touched} defects.`
      );
      onSuccess();
    } catch (err: any) {
      setResultMsg(`Error running simulator: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Are you sure you want to reset all demo data?")) return;
    try {
      setIsLoading(true);
      setResultMsg(null);
      await api.resetSimulator();
      setResultMsg("All demo data cleared successfully.");
      onSuccess();
    } catch (err: any) {
      setResultMsg(`Error resetting: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4 bg-surface-raised">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-accent-blue" />
            <h3 className="font-bold text-ink text-sm">Fleet Sensing Simulator</h3>
          </div>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <p className="text-ink-muted">
            Simulated bus edge-detection passes across demo routes — no real buses are connected.
          </p>

          <div className="space-y-3">
            <div>
              <label className="font-semibold text-ink mb-1 block">Scenario</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScenario("demo")}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                    scenario === "demo"
                      ? "border-accent-blue bg-accent-blue-soft text-accent-blue"
                      : "border-line bg-surface text-ink-muted hover:bg-surface-raised"
                  }`}
                >
                  Scripted Demo (deterministic)
                </button>
                <button
                  type="button"
                  onClick={() => setScenario("random")}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                    scenario === "random"
                      ? "border-accent-blue bg-accent-blue-soft text-accent-blue"
                      : "border-line bg-surface text-ink-muted hover:bg-surface-raised"
                  }`}
                >
                  Random Run (secondary)
                </button>
              </div>
              <p className="mt-1 text-[10px] text-ink-faint">
                Scripted: BUS_001 → 002 → 003 corroborate the same pothole, two single-bus defects stay unconfirmed, congestion covers all four intensity tiers.
              </p>
            </div>

            {scenario === "random" && (
              <>
                <div>
                  <label className="font-semibold text-ink block mb-1">
                    Number of Sensing Buses: <span className="font-mono text-accent-blue">{busCount}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={busCount}
                    onChange={(e) => setBusCount(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-ink block mb-1">
                    Detections Per Bus Pass: <span className="font-mono text-accent-blue">{eventsPerBus}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={eventsPerBus}
                    onChange={(e) => setEventsPerBus(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={seedConfirmed}
                    onChange={(e) => setSeedConfirmed(e.target.checked)}
                    className="rounded text-accent-blue focus:ring-accent-blue"
                  />
                  <span>Seed overlapping multi-bus report (Guarantees confirmed defect)</span>
                </label>
              </>
            )}
          </div>

          {resultMsg && (
            <div className="rounded-md bg-accent-blue-soft p-3 text-accent-blue text-[11px] font-medium flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{resultMsg}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-5 py-3.5 bg-surface-raised">
          <button
            type="button"
            onClick={handleReset}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-medium disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Demo Data</span>
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-raised"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRun}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-md bg-accent-blue px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-50 shadow-xs"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{isLoading ? "Running..." : "Run Simulator"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
