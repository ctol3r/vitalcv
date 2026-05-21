import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Side-by-side comparison of the conventional credentialing flow vs
 * the pilot's federal-source resolution flow. The component is
 * intentionally narrow: it names eight steps that occur today and
 * pairs each with the corresponding pilot state. The pilot column
 * does NOT claim the institution-owned steps move; it shows them
 * sitting in the same column position so the reader sees they are
 * preserved.
 */
export interface OperationalContinuityComparisonProps {
  className?: string;
}

interface ComparisonRow {
  step: string;
  today: string;
  pilot: string;
  institutionOwned: boolean;
}

const COMPARISON_ROWS: readonly ComparisonRow[] = [
  {
    step: 'NPPES identity check',
    today: 'Sending operator + receiving CVO both query NPPES independently.',
    pilot: 'NPPES lane carried on a replay envelope; receiving CVO confirms on its own credential.',
    institutionOwned: false,
  },
  {
    step: 'OIG / LEIE exclusion screen',
    today: 'Sending operator + receiving CVO each query OIG/LEIE; some institutions repeat for privileging.',
    pilot: 'OIG/LEIE lane carried with affirmative-negative finding; receiving CVO confirms on its own credential.',
    institutionOwned: false,
  },
  {
    step: 'PECOS enrollment check',
    today: 'Sending operator queries PECOS; receiving CVO re-queries; if PECOS lags, phone-tag begins.',
    pilot: 'PECOS lane carried with operator note; stale-but-signed posture explicit; receiving CVO dispositions on its own credential.',
    institutionOwned: false,
  },
  {
    step: 'State medical board PSV',
    today: 'Receiving CVO PSVs state medical board on the institution\'s own credential.',
    pilot: 'State medical board PSV remains institution-owned. The pilot does not change this step.',
    institutionOwned: true,
  },
  {
    step: 'Credentialing committee review',
    today: 'Committee meets on a fixed cadence; clinician readiness does not change scheduling.',
    pilot: 'Committee review remains institution-owned. The pilot does not change this step.',
    institutionOwned: true,
  },
  {
    step: 'Privileging decision',
    today: 'Chief of staff signs off privileging on the institution\'s own cadence.',
    pilot: 'Privileging remains institution-owned. The pilot does not change this step.',
    institutionOwned: true,
  },
  {
    step: 'Operator-to-operator phone confirmation',
    today: 'Sending and receiving operators exchange voicemails to confirm primary-source reads.',
    pilot: 'Operator note travels with each lane; voicemails are no longer the substrate of confirmation.',
    institutionOwned: false,
  },
  {
    step: 'Final acceptance of clinician for deployment',
    today: 'Receiving institution accepts the clinician for deployment on its own credential.',
    pilot: 'Final acceptance remains institution-owned. The pilot does not change this step.',
    institutionOwned: true,
  },
];

export function OperationalContinuityComparison({
  className,
}: OperationalContinuityComparisonProps) {
  return (
    <section
      data-slot="operational-continuity-comparison"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Continuity comparison · today vs pilot
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          Eight steps. The federal-source steps move onto a replay
          envelope. The institution-owned steps (state board PSV,
          committee, privileging, final acceptance) sit in the same
          column position they always have.
        </p>
      </header>
      <ul className="divide-y divide-slate-200">
        {COMPARISON_ROWS.map((row, idx) => (
          <li
            key={row.step}
            data-slot="operational-continuity-row"
            data-step-index={idx + 1}
            data-institution-owned={row.institutionOwned ? 'true' : 'false'}
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Step {String(idx + 1).padStart(2, '0')}
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-900">
                {row.step}
              </div>
              {row.institutionOwned ? (
                <div className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-700">
                  institution-owned
                </div>
              ) : null}
            </div>
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Today
              </div>
              <div className="mt-1 text-xs text-slate-700">{row.today}</div>
            </div>
            <div className="sm:col-span-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Pilot
              </div>
              <div className="mt-1 text-xs text-slate-700">{row.pilot}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
