import * as React from 'react';
import { cn } from '@/lib/utils';
import type { DeploymentReadinessExample } from '@/lib/demo/demoFixtures';

/**
 * Summary panel for the four operational benefits the pilot
 * demonstrates:
 *
 *   - fewer duplicate primary-source queries
 *   - fewer redundant operator-to-operator phone confirmations
 *   - continuity preservation across upstream registry blips
 *   - onboarding acceleration on the federal-source axis
 *
 * Each row is honest: it does NOT promise automatic acceptance,
 * instant verification, or regulatory substitution. Each row pairs
 * an operational benefit with the institutional caveat.
 */
export interface OperationalAccelerationPanelProps {
  /**
   * Optional companion data from the demoFixture; rendered as the
   * concrete cohort numbers below the narrative copy.
   */
  cohortMetrics?: readonly DeploymentReadinessExample[];
  className?: string;
}

interface Benefit {
  headline: string;
  detail: string;
  caveat: string;
}

const BENEFITS: readonly Benefit[] = [
  {
    headline: 'Reduced duplicate primary-source queries',
    detail:
      'A single federal-source resolution is anchored in a replay envelope and handed to the receiving institution. Re-running the same query during the pilot window is no longer the default.',
    caveat:
      'The receiving institution retains its own cadence for re-screening on its own credential.',
  },
  {
    headline: 'Fewer redundant operator phone confirmations',
    detail:
      'Operator-to-operator confirmation is replaced by a portable envelope: cause, source, freshness, operator note.',
    caveat:
      'When evidence is interrupted, the operator note carries the disposition. Phone confirmation is not removed; it is reserved for the cases that need it.',
  },
  {
    headline: 'Continuity preserved across upstream blips',
    detail:
      'When an upstream registry is slow or down, the lane records a stale-but-signed posture and recovers at the next refresh window without losing the chain.',
    caveat:
      'Continuity is operational, not a regulatory or compliance guarantee. The receiving institution decides what posture is acceptable for its workflow.',
  },
  {
    headline: 'Acceleration on the federal-source axis only',
    detail:
      'Federal-registry resolution accelerates from days to under an hour for the pilot cohort.',
    caveat:
      'State medical board PSV, committee review, and privileging remain institution-owned. The pilot does not change those cadences.',
  },
];

export function OperationalAccelerationPanel({
  cohortMetrics,
  className,
}: OperationalAccelerationPanelProps) {
  return (
    <section
      data-slot="operational-acceleration-panel"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Operational acceleration · what the pilot demonstrates
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          Each row pairs an operational benefit with the institutional
          caveat. The pilot is honest about what it does not change.
        </p>
      </header>
      <ul className="divide-y divide-slate-200">
        {BENEFITS.map((b) => (
          <li
            key={b.headline}
            data-slot="operational-benefit-row"
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Benefit
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {b.headline}
              </div>
            </div>
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                What changes
              </div>
              <div className="mt-1 text-xs text-slate-700">{b.detail}</div>
            </div>
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Institutional caveat
              </div>
              <div className="mt-1 text-xs text-slate-700">{b.caveat}</div>
            </div>
          </li>
        ))}
      </ul>
      {cohortMetrics && cohortMetrics.length > 0 ? (
        <footer className="border-t border-slate-200 bg-slate-50 px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            Cohort numbers
          </div>
          <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {cohortMetrics.map((m) => (
              <li
                key={m.metric}
                className="rounded-md border border-slate-300 bg-white p-2"
              >
                <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  {m.metric}
                </div>
                <div className="mt-1 text-xs text-slate-700">
                  was: {m.before}
                </div>
                <div className="mt-0.5 text-xs text-slate-900">
                  pilot: {m.after}
                </div>
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
    </section>
  );
}
