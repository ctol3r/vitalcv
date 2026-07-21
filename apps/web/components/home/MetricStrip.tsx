import * as React from 'react';

import { AnimatedMetricValue, MetricSourceTag } from '@/components/motion/EvidenceMetric';
import { getLiveSourceLanes, getReadinessDimensionLanes } from '@/lib/trust/sourceLanes';

/**
 * MetricStrip — the Anyscale "large quantitative proof" row, restricted to real,
 * defensible numbers (Chris's explicit rule: no manufactured precision).
 *
 * Every figure is grounded in the engine / verified on prod:
 *  - 03 federal lanes → NPPES is read live; OIG/LEIE is a monthly snapshot and
 *                       PECOS a quarterly snapshot (per /api/status). Calling
 *                       all three "live" was a freshness overclaim — fixed.
 *  - 04 dimensions  → the confidence-weighted set (identity, exclusion,
 *                     licensure, enrollment) on /api/trust-state.
 *  - 01 wallet      → one clinician-owned wallet, reused per move.
 *  - 00 accounts    → the public readiness lookup needs no auth.
 * The caption names what is a live read vs a dated snapshot vs source-access-
 * gated so the numbers can't be read as more than they are.
 *
 * NUM-1.5: the two system counts come from lib/trust/sourceLanes.ts — the same
 * registry that feeds /status and /api/status — so this strip changes when a
 * lane's lifecycle changes instead of staying confidently wrong. The wallet and
 * accounts figures stay literal because they are product facts, not lane state.
 */
/** Two-digit grammar (`00 → 03`) is load-bearing — see the NUM-1.3 note below. */
const pad = (n: number) => String(n).padStart(2, '0');

const STATS = [
  {
    n: pad(getLiveSourceLanes().length),
    label: 'federal source lanes',
    sub: 'NPPES live · OIG/LEIE + PECOS snapshot',
  },
  {
    n: pad(getReadinessDimensionLanes().length),
    label: 'readiness dimensions',
    sub: 'identity · exclusion · licensure · enrollment',
  },
  { n: '01', label: 'wallet you own', sub: 'reused for every move' },
  { n: '00', label: 'accounts required to look', sub: 'no card, no upload' },
] as const;

export function MetricStrip() {
  return (
    <section aria-label="What is real today" data-home-metric-strip="" className="mz mt-16">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-8 border-y border-[var(--vt-border)] py-8 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label}>
            {/* NUM-1.3: leading zeros keep their exact grammar (`00 → 03`);
                the `00` accounts figure plays the zero ink-reveal, never a
                fake 0→0 counter. All four are live system facts. */}
            <dd>
              <AnimatedMetricValue
                value={s.n}
                className="text-[clamp(40px,6vw,60px)] font-semibold leading-none tracking-tight text-[var(--vt-text-primary)]"
              />
            </dd>
            <dt className="mt-3 text-[13px] font-semibold text-[var(--vt-text-secondary)]">{s.label}</dt>
            <p className="mt-1 font-mono text-[11px] text-[var(--vt-text-muted)]">{s.sub}</p>
            <MetricSourceTag sourceClass="live-system-fact" className="mt-2" />
          </div>
        ))}
      </dl>
      <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-[var(--vt-text-muted)]">
        Only real, defensible numbers. NPPES is read live; OIG/LEIE and PECOS return dated snapshots
        (monthly and quarterly), shown with their age; state licensure is source-access-gated and
        shows as such. No pilot outcomes are claimed until a real pilot produces them.
      </p>
    </section>
  );
}

export default MetricStrip;
