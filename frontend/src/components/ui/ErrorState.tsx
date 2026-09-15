interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Couldn't load this data",
  description = "The request failed. Check the connection and try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex h-full w-full flex-col items-center justify-center gap-3 py-16 text-center"
    >
      <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full border border-accent-danger/40 bg-accent-danger-soft text-accent-danger">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 6.5v4M10 13.2h.01M17.5 10a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent-teal hover:text-accent-teal"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
