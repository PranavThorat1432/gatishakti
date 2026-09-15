import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">Error 404</p>
      <h1 className="text-lg font-semibold text-ink">This route isn't part of the platform</h1>
      <p className="max-w-sm text-sm text-ink-muted">
        Check the URL, or head back to the dashboard to keep monitoring the fleet.
      </p>
      <Link
        to="/"
        className="mt-2 rounded-md bg-accent-teal px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
