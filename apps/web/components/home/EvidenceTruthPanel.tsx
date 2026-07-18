import * as React from 'react';
import { ScrollScrubHeading } from '@/components/motion/ScrollScrubHeading';

/**
 * EvidenceTruthPanel — the fusion of Anyscale's "code → evidence proof" panel
 * and Palantir's "truth before beauty" boundary, in Calm Wave.
 *
 * Source-honesty rendered as a product feature, not defensive fine print:
 *  - LEFT  (dark technical readout): an EXAMPLE evidence trace — the anatomy
 *          behind every claim: claim, source, state, retrieval, receipt, and
 *          the review boundary. The dark panel is the one place Anyscale/Palantir
 *          both allow it: a solid technical surface for the evidence itself.
 *  - RIGHT (paper): the Truth Boundary — what VitalCV knows, by state, and then
 *          explicitly WHAT THIS DOES NOT MEAN.
 *
 * Honesty rules held here: no bare "Verified"; the trace is labelled an example
 * (not a live receipt); every row names a real source/state from the engine.
 */

type Tone = 'confirmed' | 'gated' | 'attested' | 'unknown';

const TONE_DOT: Record<Tone, string> = {
  confirmed: 'var(--vt-accent-emerald)',
  gated: 'var(--vt-state-stale, #a2670b)',
  attested: 'var(--vt-text-secondary)',
  unknown: 'var(--vt-text-muted)',
};

const TRACE_ROWS: ReadonlyArray<{ k: string; v: string }> = [
  { k: 'Claim', v: 'NPI identity' },
  { k: 'Source', v: 'CMS NPPES Registry' },
  { k: 'Retrieved', v: 'at lookup · current at retrieval' },
  { k: 'Receipt', v: 'vcv_rcpt_8F21A09D' },
];

const BOUNDARY: ReadonlyArray<{ label: string; tone: Tone; items: string[] }> = [
  { label: 'Source-backed', tone: 'confirmed', items: ['NPI identity', 'Practice taxonomy', 'Practice location'] },
  { label: 'Checked', tone: 'confirmed', items: ['Federal exclusion source (OIG / LEIE)'] },
  { label: 'Access required', tone: 'gated', items: ['State license status'] },
  { label: 'Self-attested', tone: 'attested', items: ['Preferred location', 'Compensation expectations'] },
  { label: 'Not yet known', tone: 'unknown', items: ['Current employer standing', 'Institution credentialing decision'] },
];

function Dot({ tone }: { tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: TONE_DOT[tone] }}
    />
  );
}

export function EvidenceTruthPanel() {
  return (
    <section aria-label="What sits behind every claim" data-home-evidence-truth="" className="mz">
      <p className="mz-eyebrow">Truth before beauty</p>
      {/* No pinned runway. This heading previously ran `variant="scene" pin`,
          which reserved 124vh — 1.24 screens of blank paper whose only job was
          to scrub three lines of type. That runway WAS the homepage's "too much
          empty space". `ink` scrubs the heading in place as it enters,
          reserving no scroll of its own. (The typewriter variant was tried and
          reverted — Chris, 2026-07-17 pm.) */}
      <ScrollScrubHeading
        as="h2"
        className="evidence-cinematic-heading"
        text={'Every claim shows its source.'}
        accentWords={['source.']}
        variant="ink"
      />
      {/* The triad (source / state / limits) is doctrine and stays — but as nine
          words under the heading, not thirty-two in a pinned void. */}
      <p className="mz-lede evidence-truth-lede">
        A named source, a current state, and what it does not decide.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* LEFT — example evidence trace (dark technical readout) */}
        <div
          data-home-evidence-trace=""
          className="overflow-hidden rounded-[12px] border"
          style={{ backgroundColor: 'var(--ink-900, #0f1417)', borderColor: 'rgba(255,255,255,0.10)' }}
        >
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Evidence trace
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.62)' }}>
              example
            </span>
          </div>
          <div className="px-5 py-5">
            {/* Human line above the technical metadata */}
            <div className="flex items-center gap-2">
              <Dot tone="confirmed" />
              <span className="text-[15px] font-semibold" style={{ color: '#f4f2ec' }}>
                Identity — Source-backed
              </span>
            </div>
            <dl className="mt-4 space-y-2">
              {TRACE_ROWS.map((r) => (
                <div key={r.k} className="flex items-baseline justify-between gap-4">
                  <dt className="text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{r.k}</dt>
                  <dd className="text-right font-mono text-[12px]" style={{ color: 'rgba(255,255,255,0.82)' }}>{r.v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 space-y-3 border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.62)' }}>
                  Why this matters
                </p>
                <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>
                  Identity is the anchor every other check hangs on.
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.62)' }}>
                  What this does not decide
                </p>
                <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>
                  Identity confirmation is not a completed employer credentialing decision.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — truth boundary (paper) */}
        <div
          data-home-truth-boundary=""
          className="rounded-[12px] border border-[var(--vt-border)] bg-[var(--vt-surface)] px-6 py-6"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-muted)]">
            What VitalCV knows
          </p>
          <ul className="mt-4 space-y-3.5">
            {BOUNDARY.map((g) => (
              <li key={g.label}>
                <div className="flex items-center gap-2">
                  <Dot tone={g.tone} />
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--vt-text-secondary)]">
                    {g.label}
                  </span>
                </div>
                <p className="mt-1 pl-4 text-[14px] leading-relaxed text-[var(--vt-text-primary)]">
                  {g.items.join(' · ')}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-[8px] border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">
              What this does not mean
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
              This is not a completed credentialing, privileging, or employer clearance decision.
              Institution review remains the final step.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default EvidenceTruthPanel;
