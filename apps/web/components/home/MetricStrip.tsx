import * as React from 'react';

/**
 * MetricStrip — the Anyscale "large quantitative proof" row, restricted to real,
 * defensible numbers (Chris's explicit rule: no manufactured precision).
 *
 * Every figure is grounded in the engine / verified on prod:
 *  - 03 live lanes  → NPPES, OIG/LEIE, PECOS all return live results today.
 *  - 04 dimensions  → the confidence-weighted set (identity, exclusion,
 *                     licensure, enrollment) on /api/trust-state.
 *  - 01 wallet      → one clinician-owned wallet, reused per move.
 *  - 00 accounts    → the public readiness lookup needs no auth.
 * The caption names what is live vs source-access-gated so the numbers can't be
 * read as more than they are.
 */
const STATS = [
  { n: '03', label: 'federal source lanes, live', sub: 'NPPES · OIG/LEIE · PECOS' },
  { n: '04', label: 'readiness dimensions', sub: 'identity · exclusion · licensure · enrollment' },
  { n: '01', label: 'wallet you own', sub: 'reused for every move' },
  { n: '00', label: 'accounts required to look', sub: 'no card, no upload' },
] as const;

export function MetricStrip() {
  return (
    <section aria-label="What is real today" data-home-metric-strip="" className="mz mt-16">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-8 border-y border-[var(--vt-border)] py-8 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label}>
            <dd
              className="text-[clamp(40px,6vw,60px)] font-semibold leading-none tracking-tight text-[var(--vt-text-primary)]"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {s.n}
            </dd>
            <dt className="mt-3 text-[13px] font-semibold text-[var(--vt-text-secondary)]">{s.label}</dt>
            <p className="mt-1 font-mono text-[11px] text-[var(--vt-text-muted)]">{s.sub}</p>
          </div>
        ))}
      </dl>
      <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-[var(--vt-text-muted)]">
        Only real, defensible numbers. NPPES, OIG/LEIE, and PECOS return live results today; state
        licensure is source-access-gated and shows as such. No pilot outcomes are claimed until a
        real pilot produces them.
      </p>
    </section>
  );
}

export default MetricStrip;
