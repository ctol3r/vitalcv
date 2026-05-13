import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * TrustStateBand — canonical GREEN / YELLOW / RED band rendering.
 *
 * The band is the public-passport color summary derived from the
 * canonical readiness level (`apps/api/backend/src/services/readiness/canonical.ts`):
 *   L2 / L3 → GREEN
 *   L1      → YELLOW
 *   L0      → RED
 *
 * UNKNOWN is rendered as a neutral state — used when readiness has not
 * yet been computed (no run has completed) rather than when readiness
 * has been computed and is L0.
 *
 * The primitive is intentionally separate from `TierBadge`: a TierBadge
 * carries claim-confidence semantics (T1–T4), the band carries
 * decision-readiness semantics. A clinician can be T3 (source-checked)
 * AND YELLOW band (gap remaining) at the same time.
 */
export type TrustStateBandValue = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';

const BAND_COPY: Record<TrustStateBandValue, { label: string; description: string }> = {
  GREEN:  { label: 'Ready',     description: 'Decision-grade evidence on all launch-spine sources.' },
  YELLOW: { label: 'Partial',   description: 'Some sources checked; gaps or pending items remain.' },
  RED:    { label: 'Blocked',   description: 'A hard blocker prevents a positive readiness verdict.' },
  UNKNOWN:{ label: 'Unknown',   description: 'Readiness has not been computed for this entity yet.' },
};

const BAND_CLASSES: Record<TrustStateBandValue, string> = {
  GREEN: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  YELLOW:'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  RED:   'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  UNKNOWN:'border-dashed border-zinc-400/40 bg-transparent text-zinc-500 dark:text-zinc-400',
};

export interface TrustStateBandProps {
  band: TrustStateBandValue;
  /** Show the descriptive caption beneath the label. Default true. */
  showDescription?: boolean;
  /** Optional override for the headline label ("Ready", "Partial", …). */
  labelOverride?: string;
  className?: string;
}

export function TrustStateBand({
  band,
  showDescription = true,
  labelOverride,
  className,
}: TrustStateBandProps): React.ReactElement {
  const copy = BAND_COPY[band];
  return (
    <div
      className={cn(
        'inline-flex flex-col gap-1 rounded-lg border px-3 py-2',
        BAND_CLASSES[band],
        className,
      )}
      data-trust-band={band}
      role="status"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
        <span className="font-semibold uppercase tracking-wide text-xs">
          {labelOverride ?? copy.label}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider opacity-80">{band}</span>
      </div>
      {showDescription && (
        <p className="text-[11px] opacity-80 leading-snug">{copy.description}</p>
      )}
    </div>
  );
}
