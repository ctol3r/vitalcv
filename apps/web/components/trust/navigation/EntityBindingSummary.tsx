import * as React from 'react';
import { cn } from '@/lib/utils';
import { OwnershipStateBadge, TierBadge } from '@/components/trust/primitives';
import type { OwnershipState, TrustTier } from '@/lib/trust/institutional-language';

/**
 * Subject-bound summary for an `entity` pane (passport / NPI).
 *
 * Reuses the canonical `OwnershipStateBadge` and `TierBadge` primitives
 * shipped in PR #382. The component is purely presentational — the
 * caller provides resolved values.
 */
export interface EntityBindingSummaryProps {
  /** Display name (e.g. "Mira Chen, MD"). */
  displayName: string;
  /** Subject identifier (e.g. "NPI 1356428912"). */
  subjectId: string;
  ownership: OwnershipState;
  /** Highest tier currently established for this entity (T1–T4). */
  highestTier: TrustTier;
  /** Optional summary count (e.g. "4 of 4 sources fresh"). */
  sourceSummary?: string;
  className?: string;
}

export function EntityBindingSummary({
  displayName,
  subjectId,
  ownership,
  highestTier,
  sourceSummary,
  className,
}: EntityBindingSummaryProps) {
  return (
    <section
      data-slot="entity-binding-summary"
      className={cn(
        'border-b border-slate-200 px-4 py-3',
        className,
      )}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h4 className="text-base font-semibold text-slate-900">{displayName}</h4>
        <TierBadge tier={highestTier} />
      </header>
      <p className="mt-0.5 font-mono text-[11px] text-slate-500">
        {subjectId}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <OwnershipStateBadge state={ownership} />
        {sourceSummary ? (
          <span className="font-mono text-[11px] text-slate-600">
            {sourceSummary}
          </span>
        ) : null}
      </div>
    </section>
  );
}
