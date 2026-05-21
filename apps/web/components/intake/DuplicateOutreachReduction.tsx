import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Concrete what's-reused panel. Names the four operational activities
 * the pilot reduces, each paired with what the receiving institution
 * still owns. Honest about the boundary.
 */
export interface DuplicateOutreachReductionProps {
  className?: string;
}

interface ReductionRow {
  activity: string;
  reduction: string;
  retained: string;
}

const REDUCTIONS: readonly ReductionRow[] = [
  {
    activity: 'NPPES identity lookup',
    reduction:
      'Single federal-source resolution per clinician carries name, taxonomy, and active state.',
    retained:
      'You may re-fetch on your own credential if a finding is contested.',
  },
  {
    activity: 'OIG / LEIE sanction screen',
    reduction:
      'Affirmative-negative finding recorded with the receipt; not re-run during the pilot window.',
    retained:
      'Your own re-screening cadence is unchanged; the pilot does not replace it.',
  },
  {
    activity: 'PECOS enrollment check',
    reduction:
      'Last-known state recorded with the receipt, including stale-but-signed posture when the upstream is slow.',
    retained:
      'You decide whether a stale-but-signed posture is acceptable for your workflow.',
  },
  {
    activity: 'Operator-to-operator phone confirmation',
    reduction:
      'Replaced by a portable replay envelope: cause, source, freshness, operator note.',
    retained:
      'Phone confirmation remains available for cases that need it; the envelope captures the easy ones.',
  },
];

export function DuplicateOutreachReduction({
  className,
}: DuplicateOutreachReductionProps) {
  return (
    <section
      data-slot="duplicate-outreach-reduction"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          What gets reused · what you still own
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          Four activities the pilot reduces, each paired with the
          institutional check that remains on your existing cadence.
        </p>
      </header>
      <ul className="divide-y divide-slate-200">
        {REDUCTIONS.map((row) => (
          <li
            key={row.activity}
            data-slot="duplicate-outreach-row"
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Activity
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {row.activity}
              </div>
            </div>
            <div className="sm:col-span-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                What changes
              </div>
              <p className="mt-1 text-xs text-slate-700">{row.reduction}</p>
            </div>
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                What you retain
              </div>
              <p className="mt-1 text-xs text-slate-700">{row.retained}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
