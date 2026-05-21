import * as React from 'react';
import { cn } from '@/lib/utils';
import type { OperatorReadinessItem } from '@/lib/operator/operatorFixtures';

/**
 * One-line per-cohort progression strip. Surfaces three counts per
 * cohort: ready / pending review / interrupted. Quiet, monochrome,
 * no progress bars or animated gauges.
 */
export interface ReadinessProgressStripProps {
  items: readonly OperatorReadinessItem[];
  className?: string;
}

export function ReadinessProgressStrip({
  items,
  className,
}: ReadinessProgressStripProps) {
  return (
    <section
      data-slot="readiness-progress-strip"
      data-cohort-count={items.length}
      className={cn(
        'overflow-hidden rounded-xl border border-slate-300 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-200 px-3 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Readiness · per-cohort progression
        </div>
      </header>
      <ul
        role="list"
        className="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0"
      >
        {items.map((item) => (
          <li
            key={item.id}
            data-slot="readiness-progress-cohort"
            data-cohort-id={item.id}
            className="px-3 py-2"
          >
            <div className="text-xs font-semibold text-slate-900">
              {item.cohortTag}{' '}
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                · {item.totalCandidates} candidate{item.totalCandidates === 1 ? '' : 's'}
              </span>
            </div>
            <ul className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <li
                data-slot="readiness-progress-bucket"
                data-bucket="ready"
                className="rounded border border-slate-200 bg-slate-50 px-2 py-1"
              >
                <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  Ready
                </div>
                <div className="mt-0.5 font-mono text-sm text-slate-900">
                  {item.ready}
                </div>
              </li>
              <li
                data-slot="readiness-progress-bucket"
                data-bucket="pending_review"
                className="rounded border border-slate-200 bg-slate-50 px-2 py-1"
              >
                <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  Pending
                </div>
                <div className="mt-0.5 font-mono text-sm text-slate-900">
                  {item.pendingReview}
                </div>
              </li>
              <li
                data-slot="readiness-progress-bucket"
                data-bucket="interrupted"
                className={cn(
                  'rounded border px-2 py-1',
                  item.interrupted > 0
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-slate-200 bg-slate-50',
                )}
              >
                <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  Interrupted
                </div>
                <div className="mt-0.5 font-mono text-sm text-slate-900">
                  {item.interrupted}
                </div>
              </li>
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
