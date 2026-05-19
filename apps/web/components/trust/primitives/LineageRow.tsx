import * as React from 'react';
import { cn } from '@/lib/utils';
import type { LineageTrustState } from '@/lib/trust/replay-grammar';
import type {
  OwnershipState,
  TrustTier,
} from '@/lib/trust/institutional-language';
import { OwnershipStateBadge } from './OwnershipStateBadge';
import { TierBadge } from './TierBadge';
import { CheckedAtStamp } from './CheckedAtStamp';

/**
 * One claim · six labeled primitives.
 *
 * Source: Lineage Row.html · "Anatomy of one row · six primitives".
 * Every claim carries six things you can name. If a primitive isn't
 * present, the row doesn't assert it. Missing primitive reads as a gap,
 * not as silence.
 */
export interface LineageRowProps {
  /** What the claim names (e.g. "CA medical license"). */
  claim: string;
  /** Subject label (e.g. "subj · npi 1356428912 · dr. mira chen, md"). */
  subject: string;
  /** Named source registry. */
  source: string;
  /** Source state caption (e.g. "live · ca-pa registry"). */
  sourceState: string;
  /** checked_at ISO + relative. */
  checkedAtIso: string | null;
  checkedAtRelative: string;
  ownership: OwnershipState;
  /** Replay state label: "Anchored" · "Logged · pending anchor" · "Not written". */
  replay: string;
  tier: TrustTier;
  /** Issuer-signed state for this row's receipt. */
  signed: boolean;
  /** Verification-run fingerprint. */
  runId: string;
  rowState: LineageTrustState;
  degraded?: boolean;
  className?: string;
}

const ROW_FRAME: Record<LineageTrustState, string> = {
  preview: 'border-dashed border-slate-400 bg-amber-50/30',
  snapshot: 'border-solid border-slate-300 bg-white',
  signed: 'border-solid border-slate-900 bg-white',
};

export function LineageRow(props: LineageRowProps) {
  const {
    claim,
    subject,
    source,
    sourceState,
    checkedAtIso,
    checkedAtRelative,
    ownership,
    replay,
    tier,
    signed,
    runId,
    rowState,
    degraded = false,
    className,
  } = props;

  return (
    <article
      data-slot="lineage-row"
      data-state={rowState}
      data-degraded={degraded ? 'true' : undefined}
      className={cn(
        'rounded-2xl border p-4 text-sm',
        ROW_FRAME[rowState],
        degraded && 'border-l-4 border-l-amber-400',
        className,
      )}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h4 className="text-base font-semibold">{claim}</h4>
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          {subject}
        </span>
      </header>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Cell label="Source · checked">
          <div className="font-medium">{source}</div>
          <div className="font-mono text-[11px] text-slate-600">
            {sourceState}
          </div>
        </Cell>
        <Cell label="checked_at">
          <CheckedAtStamp
            iso={checkedAtIso}
            relative={checkedAtRelative}
            degraded={degraded}
          />
        </Cell>
        <Cell label="Ownership">
          <OwnershipStateBadge state={ownership} />
        </Cell>
        <Cell label="Replay">
          <span className="font-mono text-xs">{replay}</span>
        </Cell>
        <Cell label="Tier">
          <TierBadge tier={tier} />
        </Cell>
        <Cell label="Receipt">
          <span
            className={cn(
              'inline-flex items-center font-mono text-xs',
              signed ? 'text-slate-900' : 'text-slate-500',
            )}
          >
            {signed ? 'Signed · ed25519' : 'Unsigned'}
          </span>
        </Cell>
      </dl>
      <footer className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2 font-mono text-[11px] text-slate-600">
        <span>run · {runId}</span>
      </footer>
    </article>
  );
}

function Cell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
