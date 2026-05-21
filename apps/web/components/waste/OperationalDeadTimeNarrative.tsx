import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Narrative 4 · Operational dead time as waste.
 *
 * The clinician is hired, signed, oriented, and ready to see patients,
 * but the credentialing committee is still scheduled four weeks out.
 * That gap is dead time. The narrative names the categories of dead
 * time, names what the institution still owns (committee cadence,
 * privileging decisions), and avoids any claim that committee
 * scheduling itself shortens.
 */
export interface OperationalDeadTimeNarrativeProps {
  className?: string;
}

interface DeadTimeRow {
  category: string;
  whatHappens: string;
  whatStays: string;
}

const DEAD_TIME_ROWS: readonly DeadTimeRow[] = [
  {
    category: 'Federal-source resolution wait',
    whatHappens:
      'Receiving CVO waits days for NPPES, OIG/LEIE, PECOS confirmations to come back through their normal channels.',
    whatStays:
      'Receiving CVO continues to confirm against its own credential on intake day.',
  },
  {
    category: 'Phone-tag confirmation',
    whatHappens:
      'Sending operator and receiving operator exchange voicemails confirming the same primary source.',
    whatStays:
      'Operators continue to talk for everything outside federal-source lanes (committee context, references, history).',
  },
  {
    category: 'Re-query after registry lag',
    whatHappens:
      'When PECOS lags, the receiving operator re-queries themselves to satisfy their own freshness budget.',
    whatStays:
      'Receiving operator may still re-fetch on their own credentials when their freshness policy requires it.',
  },
  {
    category: 'Committee-window dead time',
    whatHappens:
      'Clinician is otherwise ready; the next credentialing committee is two-to-four weeks out.',
    whatStays:
      'Committee cadence is institution-owned; this page does not claim committee scheduling accelerates.',
  },
  {
    category: 'Privileging-decision dead time',
    whatHappens:
      'Privileging decisions await chief-of-staff sign-off on the institution\'s schedule.',
    whatStays:
      'Privileging is institution-owned; nothing on this page changes that.',
  },
];

export function OperationalDeadTimeNarrative({
  className,
}: OperationalDeadTimeNarrativeProps) {
  return (
    <section
      data-slot="operational-dead-time-narrative"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Narrative 04 · operational dead time
        </div>
        <h3 className="mt-1 text-sm font-semibold text-slate-900">
          Dead time has a category. Most categories are still institution-owned.
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          Five places dead time shows up. Only one (federal-source
          resolution wait) compresses. Four remain on the institution's
          own cadence and the page does not claim otherwise.
        </p>
      </header>
      <ul className="divide-y divide-slate-200">
        {DEAD_TIME_ROWS.map((row) => (
          <li
            key={row.category}
            data-slot="operational-dead-time-row"
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Category
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-900">
                {row.category}
              </div>
            </div>
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                What happens today
              </div>
              <div className="mt-1 text-xs text-slate-700">{row.whatHappens}</div>
            </div>
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                What stays institution-owned
              </div>
              <div className="mt-1 text-xs text-slate-700">{row.whatStays}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
