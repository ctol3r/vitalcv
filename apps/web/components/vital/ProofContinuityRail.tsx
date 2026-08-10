import * as React from 'react';
import Link from 'next/link';

import { type EvidenceState, evidenceStateMeta, TONE_COLOR } from '@/lib/vital/evidenceState';
import { EvidenceProvenanceChip as StateChip } from '@/lib/vital/evidenceStateToProvenance';

/**
 * ProofContinuityRail — the ONE shared continuity component the audit says the
 * product is missing: every source lane in one place, each with its state, when
 * it was last checked, why it matters, and the action that would advance it —
 * plus an aggregate tray. Meant to appear identically on the homepage result,
 * onboarding result, Wallet, Passport, opportunity fit, and employer review, so
 * the clinician sees the same proof picture everywhere.
 */
export interface ProofLane {
  id: string;
  label: string; // "NPPES", "OIG / LEIE", "PECOS", "State board", "Training", "Employment"
  state: EvidenceState;
  checkedAt?: string;
  checkedAtISO?: string;
  /** Why this lane matters — shown as supporting context. */
  why?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

/** Aggregate bucket order for the tray. */
const BUCKET_ORDER: EvidenceState[] = [
  'source_backed',
  'checked',
  'needs_review',
  'self_attested',
  'access_required',
  'unavailable',
  'employer_decision',
];

function aggregate(lanes: ProofLane[]): Array<{ state: EvidenceState; count: number }> {
  const counts = new Map<EvidenceState, number>();
  for (const l of lanes) counts.set(l.state, (counts.get(l.state) ?? 0) + 1);
  return BUCKET_ORDER.filter((s) => counts.has(s)).map((s) => ({ state: s, count: counts.get(s)! }));
}

export function ProofContinuityRail({
  lanes,
  className,
  heading = 'Proof continuity',
}: {
  lanes: ProofLane[];
  className?: string;
  heading?: string;
}) {
  const tray = aggregate(lanes);
  return (
    <section
      aria-label={heading}
      data-proof-rail=""
      className={`rounded-[12px] border border-[var(--vt-border)] bg-[var(--vt-surface)] ${className ?? ''}`}
    >
      <div className="flex items-center justify-between border-b border-[var(--vt-border)] px-4 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-muted)]">{heading}</p>
      </div>

      <ul className="divide-y divide-[var(--vt-border-subtle,var(--vt-border))] px-4">
        {lanes.map((lane) => (
          <li key={lane.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[var(--vt-text-primary)]">{lane.label}</span>
              </div>
              {lane.why && <p className="mt-0.5 text-[12px] leading-snug text-[var(--vt-text-secondary)]">{lane.why}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--vt-text-muted)]">
                {lane.checkedAt && (
                  <time data-ts="" dateTime={lane.checkedAtISO} className="font-mono">
                    {lane.checkedAt}
                  </time>
                )}
                {lane.action &&
                  (lane.action.href ? (
                    <Link href={lane.action.href} className="font-semibold text-[var(--vt-text-primary)] underline-offset-4 hover:underline">
                      {lane.action.label}
                    </Link>
                  ) : (
                    <button type="button" onClick={lane.action.onClick} className="font-semibold text-[var(--vt-text-primary)] underline-offset-4 hover:underline">
                      {lane.action.label}
                    </button>
                  ))}
              </div>
            </div>
            {/* W1082: a rail lane IS a source lane — its label names the source
                ("NPPES identity", "OIG exclusions"), so the label is the honest
                attribution. asOf: null on lanes never checked announces
                "as-of not recorded" rather than inventing a timestamp. */}
            <StateChip
              state={lane.state}
              attribution={{ source: lane.label, asOf: lane.checkedAt ?? null, asOfISO: lane.checkedAtISO }}
              size="sm"
              className="mt-0.5 shrink-0"
            />
          </li>
        ))}
      </ul>

      {/* Aggregate tray */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--vt-border)] px-4 py-3">
        {tray.map(({ state, count }) => {
          const meta = evidenceStateMeta(state);
          return (
            <span key={state} className="inline-flex items-center gap-1.5 text-[12px]">
              <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: TONE_COLOR[meta.tone] }} />
              <span className="tabular-nums font-semibold text-[var(--vt-text-primary)]">{count}</span>
              <span className="text-[var(--vt-text-secondary)]">{meta.label}</span>
            </span>
          );
        })}
      </div>
    </section>
  );
}

export default ProofContinuityRail;
