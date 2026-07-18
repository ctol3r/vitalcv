import * as React from 'react';

/**
 * ProblemStatBand — the pitch deck's "trust-liquidity problem" numbers, in Calm
 * Wave. Three big figures state the problem VitalCV addresses. Structure from
 * the deck; skin stays paper/ink.
 *
 * Honesty: every figure is an INDUSTRY number about the problem (cited below),
 * never a VitalCV outcome claim. The deck's own "honest claim" slide is the
 * rule — VitalCV addresses the self-inflicted verification-queue slice, not the
 * underlying clinician supply gap.
 */
const PROBLEM_STATS = [
  {
    n: '90–120',
    unit: 'days',
    label: 'from interview to start in slow verification queues',
  },
  {
    n: '5+',
    unit: 'systems',
    label: 'a clinician is checked across before they can legally work',
  },
  {
    n: '0',
    unit: 'portable',
    label: 'source-backed proof that travels with the clinician today',
  },
] as const;

export function ProblemStatBand() {
  return (
    <section aria-label="The problem VitalCV addresses" data-home-problem-band="" className="mz pt-14">
      <p className="mz-eyebrow">The problem</p>
      <h2 className="mz-h1 mt-3 max-w-[16ch]">
        Healthcare hiring has a <em className="mz-accent">trust-liquidity</em> problem.
      </h2>
      <p className="mz-body mt-3 max-w-2xl text-[var(--vt-text-secondary)]">
        Every employer re-asks, re-checks, and re-builds evidence that should travel with the clinician.
      </p>

      <dl className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {PROBLEM_STATS.map((s) => (
          <div
            key={s.label}
            className="rounded-[14px] border border-[var(--vt-border)] bg-[var(--vt-surface)] px-6 py-7"
          >
            <dd className="flex items-baseline gap-2">
              <span
                className="text-[clamp(44px,6vw,68px)] font-semibold leading-none tracking-tight text-[var(--vt-text-primary)]"
                style={{ fontFamily: 'var(--mz-serif)', fontVariantNumeric: 'tabular-nums' }}
              >
                {s.n}
              </span>
              <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
                {s.unit}
              </span>
            </dd>
            <dt className="mt-3 text-[14px] leading-relaxed text-[var(--vt-text-secondary)]">{s.label}</dt>
          </div>
        ))}
      </dl>

      <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-[var(--vt-text-muted)]">
        Industry figures (CompHealth, AMN / Merritt Hawkins, NSI / Becker&rsquo;s, AAMC 2024). VitalCV
        addresses the self-inflicted verification-queue slice — not the underlying clinician supply gap.
      </p>
    </section>
  );
}

export default ProblemStatBand;
