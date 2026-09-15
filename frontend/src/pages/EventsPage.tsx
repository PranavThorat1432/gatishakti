import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { PotholeEvent } from "../types/api";
import { LoadingState } from "../components/ui/LoadingState";
import { ErrorState } from "../components/ui/ErrorState";
import { Search, Filter, Bus } from "lucide-react";

export function EventsPage() {
  const [events, setEvents] = useState<PotholeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");

  const loadEvents = () => {
    setLoading(true);
    setError(null);
    api
      .getEvents()
      .then(setEvents)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load the events log.")
      )
      .finally(() => setLoading(false));
  };

  useEffect(loadEvents, []);

  const filtered = events.filter((e) => {
    const matchesSearch =
      e.bus_id.toLowerCase().includes(search.toLowerCase()) ||
      e.id.toLowerCase().includes(search.toLowerCase());
    const matchesSev = severityFilter === "all" || e.severity === severityFilter;
    return matchesSearch && matchesSev;
  });

  if (loading) return <LoadingState label="Loading events log" />;

  if (error) {
    return <ErrorState title="Events log unavailable" description={error} onRetry={loadEvents} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-ink">Sensing Observations Log</h2>
          <p className="text-xs text-ink-muted">
            Raw pothole observations ingested from the simulated sensing fleet — every row is one observation from one bus
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-faint" />
            <input
              type="text"
              placeholder="Search Bus ID or Event ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-line bg-surface pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-faint focus:border-accent-blue focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-ink-faint" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink font-medium"
            >
              <option value="all">All Severities</option>
              <option value="high">High Severity</option>
              <option value="medium">Medium Severity</option>
              <option value="low">Low Severity</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-surface-raised font-mono text-[10px] uppercase text-ink-faint">
              <tr>
                <th className="px-4 py-3">Event ID</th>
                <th className="px-4 py-3">Bus ID</th>
                <th className="px-4 py-3">GPS Location</th>
                <th className="px-4 py-3">AI Confidence</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-ink-faint">
                    No matching events found.
                  </td>
                </tr>
              ) : (
                filtered.map((evt) => (
                  <tr key={evt.id} className="hover:bg-surface-raised/60 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-ink" title={`internal id: ${evt.id}`}>
                      {evt.display_id || evt.id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded bg-accent-blue-soft px-2 py-0.5 font-mono text-[11px] font-bold text-accent-blue">
                        <Bus className="h-3 w-3" />
                        {evt.bus_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-muted">
                      {evt.location.lat.toFixed(4)}, {evt.location.lng.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {(evt.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          evt.severity === "high"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : evt.severity === "medium"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        }`}
                      >
                        {evt.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] uppercase text-ink-faint">
                      {evt.source}
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-ink-muted"
                      title={`Ingested by the platform at ${new Date(evt.created_at).toLocaleString()}`}
                    >
                      {new Date(evt.observed_at || evt.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
