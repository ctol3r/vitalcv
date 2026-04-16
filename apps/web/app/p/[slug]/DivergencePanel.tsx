import React from 'react';

/**
 * DivergencePanel — surfaces cross-source conflicts when present.
 *
 * Pure presentation; no hooks. Renders an explicit "All sources agree"
 * state when activeCount === 0 so the absence of divergence is visible
 * rather than silent.
 */

export interface DivergenceInput {
  activeCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  summary: string;
  conflicts: Array<{
    id: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    sources: string[];
    active: boolean;
    resolution: 'OPEN' | 'RESOLVED';
  }>;
}

const SEVERITY_TONE: Record<'HIGH' | 'MEDIUM' | 'LOW', string> = {
  HIGH: 'border-red-500/50 bg-red-500/10 text-red-700',
  MEDIUM: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
  LOW: 'border-slate-500/40 bg-slate-500/10 text-slate-700',
};

export function DivergencePanel({ divergence }: { divergence: DivergenceInput | null | undefined }) {
  if (!divergence) return null;

  if (divergence.activeCount === 0) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-800">
        <p className="text-xs font-semibold uppercase tracking-widest text-green-700">
          Source agreement
        </p>
        <p className="mt-1">All checked sources agree — no cross-source divergence.</p>
      </div>
    );
  }

  const activeConflicts = divergence.conflicts.filter((c) => c.active);

  return (
    <details open className="rounded-lg border-2 border-red-500/40 bg-red-500/5 px-5 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-red-700">
          Cross-source divergence
          <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] tabular-nums text-red-800">
            {divergence.activeCount}
          </span>
        </span>
        <span className="text-[11px] tabular-nums text-red-700">
          {divergence.highCount}H · {divergence.mediumCount}M · {divergence.lowCount}L
        </span>
      </summary>
      {divergence.summary && (
        <p className="mt-3 break-words text-sm text-foreground">{divergence.summary}</p>
      )}
      <ul className="mt-3 space-y-2">
        {activeConflicts.map((c) => (
          <li
            key={c.id}
            className={`rounded border px-3 py-2 text-sm ${SEVERITY_TONE[c.severity]}`}
          >
            <p className="break-words font-medium">
              <span className="mr-2 text-[10px] font-semibold uppercase tracking-widest opacity-80">
                {c.severity}
              </span>
              {c.description}
            </p>
            {c.sources.length > 0 && (
              <p className="mt-1 text-[11px] opacity-75">
                Sources: {c.sources.join(', ')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
