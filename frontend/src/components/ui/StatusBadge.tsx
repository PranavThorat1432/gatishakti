type StatusTone = "amber" | "teal" | "danger" | "neutral";

interface StatusBadgeProps {
  label: string;
  tone: StatusTone;
}

const toneClasses: Record<StatusTone, string> = {
  amber: "bg-accent-amber-soft text-accent-amber",
  teal: "bg-accent-teal-soft text-accent-teal",
  danger: "bg-accent-danger-soft text-accent-danger",
  neutral: "bg-surface-raised text-ink-muted",
};

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 font-mono text-[11px] font-medium ${toneClasses[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
