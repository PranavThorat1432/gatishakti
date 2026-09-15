import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Unhandled application error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
    window.location.assign("/");
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-accent-danger/40 bg-accent-danger-soft text-accent-danger">
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M10 6.5v4M10 13.2h.01M17.5 10a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-semibold text-ink">
              The control platform hit an unexpected error
            </h1>
            <p className="mt-1 max-w-md text-sm text-ink-muted">
              This screen stopped responding. Returning to the dashboard usually clears it. If it
              keeps happening, note what you were doing right before it broke.
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-md bg-accent-teal px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Return to dashboard
          </button>
          <pre className="mt-4 max-w-lg overflow-auto rounded-md border border-line bg-surface p-3 text-left font-mono text-[11px] text-ink-faint">
            {this.state.error.message}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
