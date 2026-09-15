import { EmptyState } from "../components/ui/EmptyState";

interface PlaceholderPageProps {
  title: string;
  description: string;
  phase: string;
}

export function PlaceholderPage({ title, description, phase }: PlaceholderPageProps) {
  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-lg border border-dashed border-line bg-surface">
      <EmptyState
        title={title}
        description={description}
        icon={
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M4 6h12M4 10h12M4 14h8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        }
        action={
          <span className="rounded-sm border border-line bg-canvas px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
            {phase}
          </span>
        }
      />
    </div>
  );
}
