import * as React from 'react';
import { cn } from '@/lib/utils';
import type { DeploymentReadinessExample } from '@/lib/demo/demoFixtures';

/**
 * Narrative panel that frames operational acceleration in
 * institutional terms. Each row pairs a before/after metric with a
 * one-sentence institutional framing line.
 *
 * Never claims automatic acceptance, instant verification, or
 * regulatory substitution. The framing line explicitly names what
 * remains institution-owned.
 */
export interface EvidenceReuseNarrativeProps {
  rows: readonly DeploymentReadinessExample[];
  className?: string;
}

export function EvidenceReuseNarrative({
  rows,
  className,
}: EvidenceReuseNarrativeProps) {
  return (
    <section
      data-slot="evidence-reuse-narrative"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Where the replay envelope reduces duplication
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          Replayable evidence reduces duplicate primary-source queries
          and ad-hoc operator outreach. It does not replace
          institutional sign-off or regulatory verification.
        </p>
      </header>
      <ul className="divide-y divide-slate-200">
        {rows.map((row) => (
          <li
            key={row.metric}
            data-slot="evidence-reuse-row"
            className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Metric
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {row.metric}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Cedar CVO baseline
              </div>
              <div className="mt-1 text-sm text-slate-700">{row.before}</div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Pilot target
              </div>
              <div className="mt-1 text-sm text-slate-900">{row.after}</div>
            </div>
            <div className="sm:col-span-12">
              <p className="text-xs text-slate-600">{row.institutionalFraming}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
