import * as React from 'react';
import { cn } from '@/lib/utils';
import type { DeploymentReadinessExample } from '@/lib/demo/demoFixtures';

/**
 * Summary panel that frames evidence reuse in receiver-side terms.
 * Renders the cohort's before/after metrics from the fixture, plus
 * three binding boundary claims so the reuse story stays honest.
 *
 * The three boundary claims are non-removable. They appear on every
 * render and are the institutional contract: no guaranteed
 * acceptance, no regulatory replacement, no automatic trust transfer.
 */
export interface EvidenceReuseSummaryProps {
  metrics: readonly DeploymentReadinessExample[];
  className?: string;
}

const BOUNDARY_CLAIMS: readonly string[] = [
  'Reuse does not constitute guaranteed acceptance of any clinician.',
  'Reuse is not a regulatory replacement for state-board or committee verification.',
  'Reuse does not transfer trust automatically; the receiving institution confirms on its own credential.',
];

export function EvidenceReuseSummary({
  metrics,
  className,
}: EvidenceReuseSummaryProps) {
  return (
    <section
      data-slot="evidence-reuse-summary"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Evidence reuse summary · what changes, what does not
        </h3>
      </header>
      <ul className="divide-y divide-slate-200">
        {metrics.map((m) => (
          <li
            key={m.metric}
            data-slot="evidence-reuse-summary-row"
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Metric
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {m.metric}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Baseline
              </div>
              <div className="mt-1 text-xs text-slate-700">{m.before}</div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Pilot target
              </div>
              <div className="mt-1 text-xs text-slate-900">{m.after}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Framing
              </div>
              <p className="mt-1 text-xs text-slate-700">
                {m.institutionalFraming}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <footer
        data-slot="evidence-reuse-summary-boundary-claims"
        className="border-t border-dashed border-slate-400 bg-slate-50 px-4 py-3"
      >
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Binding boundary claims (always rendered)
        </div>
        <ul className="mt-2 space-y-1 text-xs text-slate-700">
          {BOUNDARY_CLAIMS.map((claim) => (
            <li
              key={claim}
              data-slot="boundary-claim"
              className="flex gap-2"
            >
              <span aria-hidden="true">·</span>
              <span>{claim}</span>
            </li>
          ))}
        </ul>
      </footer>
    </section>
  );
}
