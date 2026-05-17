'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import {
  CBP_CREDENTIALING_DAYS,
  DAILY_DELAY_COST_HIGH,
  DAILY_DELAY_COST_LOW,
  DAYS_SAVED,
  MARKET_BENCHMARK_LABELS,
  SPECIALTY_LABEL,
  SPECIALTY_OPTIONS,
  TRADITIONAL_CREDENTIALING_DAYS,
  computeRoiRange,
  formatUsdCompact,
  type Specialty,
} from '@/app/demo/_marketData';

/**
 * RoiCalculator — interactive illustrative ROI block.
 *
 * Inputs (all client-side; no fetch):
 *   - provider count
 *   - telehealth originating hospitals
 *   - specialty selector
 *
 * Outputs:
 *   - days saved (constant per benchmark)
 *   - daily exposure range
 *   - total exposure-avoided range (scaled by provider count)
 *   - specialty-aware narrative line
 *   - telehealth multiplier disclosure when originating hospitals > 1
 *
 * TRUTH POSTURE: every number is labeled "illustrative market
 * benchmark — not a guaranteed VitalCV outcome". Specialty
 * multiplication is arithmetic; no specialty-specific revenue
 * "boost" is claimed.
 */

const PROVIDER_OPTIONS = [1, 5, 10, 25] as const;
const ORIGINATING_HOSPITAL_OPTIONS = [1, 5, 10, 20] as const;

function specialtyHeadline(s: Specialty): string {
  switch (s) {
    case 'cardiothoracic_surgery':
    case 'orthopedic_surgery':
      return 'Every delayed start can idle a revenue-critical service line.';
    case 'psychiatry':
    case 'primary_care':
      return 'Credentialing drag becomes burnout drag.';
    case 'img_rural_primary_care':
      return 'The workforce you need is trapped in credentialing friction.';
    case 'nurse_practitioner':
      return 'Multi-state scope-of-practice variation compounds the cycle.';
    case 'hospitalist':
    case 'emergency_medicine':
    case 'obgyn':
    default:
      return 'Source-backed readiness shortens the cycle for every role.';
  }
}

export interface RoiCalculatorProps {
  className?: string;
  defaultSpecialty?: Specialty;
  /** Hide the methodology footnote (used when block is embedded inside a larger ROI section that already discloses methodology). */
  hideFootnote?: boolean;
}

export function RoiCalculator({
  className,
  defaultSpecialty = 'primary_care',
  hideFootnote = false,
}: RoiCalculatorProps) {
  const [providerCount, setProviderCount] = React.useState<number>(1);
  const [hospitals, setHospitals] = React.useState<number>(1);
  const [specialty, setSpecialty] = React.useState<Specialty>(defaultSpecialty);

  const { totalLow, totalHigh } = computeRoiRange({ providerCount });

  return (
    <section
      className={cn(
        'rounded-md border border-border bg-card p-6 sm:p-8',
        className,
      )}
      aria-labelledby="roi-heading"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">
        {MARKET_BENCHMARK_LABELS.illustrative} — {MARKET_BENCHMARK_LABELS.notGuaranteed}
      </p>
      <h3
        id="roi-heading"
        className="mt-2 text-base font-semibold leading-snug text-foreground sm:text-lg"
      >
        {specialtyHeadline(specialty)}
      </h3>

      {/* Controls */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Specialty
          </span>
          <select
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value as Specialty)}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {SPECIALTY_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {SPECIALTY_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Provider count
          </span>
          <select
            value={providerCount}
            onChange={(e) => setProviderCount(Number(e.target.value))}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {PROVIDER_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'provider' : 'providers'}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Telehealth originating hospitals
          </span>
          <select
            value={hospitals}
            onChange={(e) => setHospitals(Number(e.target.value))}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {ORIGINATING_HOSPITAL_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'hospital' : 'hospitals'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Results */}
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Traditional credentialing"
          value={`~${TRADITIONAL_CREDENTIALING_DAYS} days`}
        />
        <Stat
          label="Credentialing by proxy"
          value={`~${CBP_CREDENTIALING_DAYS} days`}
        />
        <Stat label="Days saved per role" value={`~${DAYS_SAVED} days`} />
        <Stat
          label="Daily exposure"
          value={`$${DAILY_DELAY_COST_LOW.toLocaleString()}–$${DAILY_DELAY_COST_HIGH.toLocaleString()}/day`}
        />
        <Stat
          label="Total exposure avoided"
          value={`${formatUsdCompact(totalLow)}–${formatUsdCompact(totalHigh)}`}
          detail={`${providerCount} ${providerCount === 1 ? 'provider' : 'providers'} × ${DAYS_SAVED} days × the daily-exposure range above.`}
        />
        <Stat
          label="Specialty"
          value={SPECIALTY_LABEL[specialty]}
        />
      </dl>

      {/* Telehealth multiplier disclosure */}
      {hospitals > 1 && (
        <p className="mt-5 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
          Traditional telehealth credentialing can multiply the same review
          across many originating sites. VitalCV shows how a single
          source-backed packet reused as a credentialing head start could
          reduce repeated evidence gathering across {hospitals} originating
          hospitals.
        </p>
      )}

      {!hideFootnote && (
        <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
          {MARKET_BENCHMARK_LABELS.methodology} Multiplication is arithmetic; no
          VitalCV outcome is implied. Pilot results should replace these
          illustrative numbers as soon as real cycle data is available.
        </p>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm font-semibold text-foreground">
        {value}
      </dd>
      {detail && (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {detail}
        </p>
      )}
    </div>
  );
}

export default RoiCalculator;
