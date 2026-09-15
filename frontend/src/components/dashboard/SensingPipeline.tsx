const STAGES = [
  "BUS CAMERA (EDGE)",
  "AI POTHOLE DETECTION",
  "GPS + TIMESTAMP",
  "CLOUD INGESTION (API)",
  "CENTRAL DATABASE",
  "MULTI-BUS FUSION",
  "MAP INTELLIGENCE",
];

export function SensingPipeline() {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-2xs">
      <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-ink">Sensing Pipeline</h3>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {STAGES.map((stage, i) => (
          <span key={stage} className="flex items-center gap-2">
            {i > 0 && <span className="text-ink-faint" aria-hidden="true">→</span>}
            <span
              className={`rounded border px-2 py-1 font-mono text-[10px] font-bold tracking-wide ${
                i === STAGES.length - 1
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-line bg-surface-raised/70 text-ink-muted"
              }`}
            >
              {stage}
            </span>
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
        One bus report is an observation. Independent reports from 2+ unique buses within the fusion
        radius and time window confirm a persistent road-defect record.
      </p>
    </div>
  );
}
