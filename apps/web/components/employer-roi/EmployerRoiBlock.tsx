import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * EmployerRoiBlock — illustrative market-benchmark ROI block for the
 * employer demo + launch page.
 *
 * IMPORTANT: every value here is labeled as an ILLUSTRATIVE MARKET
 * BENCHMARK, NOT a guaranteed VitalCV outcome. The benchmark sources
 * are public-domain healthcare workforce research; the resulting
 * opportunity figures are derived arithmetically.
 *
 * No claim that a particular employer will see these numbers. The
 * footnote and section labels make this unambiguous.
 */

interface RoiRow {
  label: string;
  value: string;
  detail?: string;
}

const BASELINE: ReadonlyArray<RoiRow> = [
  {
    label: 'Traditional credentialing benchmark',
    value: '~103 days',
    detail: 'Common industry benchmark for primary-source verification + privileging cycle.',
  },
  {
    label: 'Credentialing-by-proxy benchmark',
    value: '~36 days',
    detail: 'Benchmark cycle when readiness is reusable across reviewers.',
  },
  {
    label: 'Day-count difference',
    value: '~67 days',
    detail: 'The cycle compression a reusable readiness layer can address.',
  },
];

const DELAY_COST: ReadonlyArray<RoiRow> = [
  {
    label: 'Delay cost per day (lower bound)',
    value: '~$2,700/day',
    detail: 'Public benchmark for clinician revenue + role-vacancy cost.',
  },
  {
    label: 'Delay cost per day (upper bound)',
    value: '~$5,400/day',
    detail: 'Specialty-weighted upper bound from the same benchmark range.',
  },
];

const OPPORTUNITY: ReadonlyArray<RoiRow> = [
  {
    label: '67-day reduction · per role',
    value: '~$181k–$362k',
    detail: '67 days × the delay-cost range above.',
  },
  {
    label: 'Full 103-day delay avoided · per role',
    value: '~$278k–$556k',
    detail: '103 days × the delay-cost range above.',
  },
];

function RoiTable({ rows }: { rows: ReadonlyArray<RoiRow> }) {
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.label}
          className="rounded-md border border-border bg-card p-4"
        >
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium text-foreground">{r.label}</p>
            <p className="font-mono text-sm font-semibold text-foreground">
              {r.value}
            </p>
          </div>
          {r.detail && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {r.detail}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export interface EmployerRoiBlockProps {
  className?: string;
  /** When true, hides the verbose section labels. Useful inside small footers. */
  compact?: boolean;
}

export function EmployerRoiBlock({ className, compact = false }: EmployerRoiBlockProps) {
  return (
    <section
      className={cn(
        'rounded-md border border-border bg-card p-6 sm:p-8',
        className,
      )}
      aria-labelledby="employer-roi-heading"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">
        Illustrative market benchmark — not a guaranteed VitalCV outcome
      </p>
      <h3
        id="employer-roi-heading"
        className="mt-2 text-base font-semibold leading-snug text-foreground sm:text-lg"
      >
        Where the credentialing dollars sit.
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Numbers below are public benchmark figures applied to a single role.
        Actual VitalCV outcomes depend on the hospital&apos;s privileging
        process, role mix, and integration depth.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div>
          {!compact && (
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Baseline cycle
            </p>
          )}
          <RoiTable rows={BASELINE} />
        </div>
        <div>
          {!compact && (
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Delay-cost range
            </p>
          )}
          <RoiTable rows={DELAY_COST} />
        </div>
        <div>
          {!compact && (
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Illustrative opportunity
            </p>
          )}
          <RoiTable rows={OPPORTUNITY} />
        </div>
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
        Methodology: industry benchmark ~103 days for primary-source-verification
        credentialing; ~36 days for credentialing-by-proxy / reusable
        readiness; per-day delay cost ~$2,700–$5,400 reflecting clinician
        revenue + vacancy costs. Multiplication is arithmetic; no VitalCV
        outcome is implied. These figures are sized for a single role; pilot
        results should replace these illustrative numbers as soon as real
        cycle data is available.
      </p>
    </section>
  );
}

export default EmployerRoiBlock;
