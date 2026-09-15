interface LoadingStateProps {
  label?: string;
  rows?: number;
}

export function LoadingState({ label = "Loading data", rows = 3 }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-full w-full flex-col items-center justify-center gap-4 py-16 text-center"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent-teal" />
      <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">{label}&hellip;</p>
      <div className="mt-2 w-full max-w-sm space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded-sm bg-surface-raised"
            style={{ width: `${85 - i * 15}%`, marginInline: "auto" }}
          />
        ))}
      </div>
    </div>
  );
}
