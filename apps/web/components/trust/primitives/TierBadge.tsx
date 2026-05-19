import * as React from 'react';
import { cn } from '@/lib/utils';
import { TIER_LABELS, type TrustTier } from '@/lib/trust/institutional-language';

/**
 * Trust ontology · T1–T4 · four fixed values.
 *
 * Source: Trust Primitives.html §03. Darkening fill = closer to a
 * signed VC. Always monospaced, never rounded. "T5" is banned.
 */
export interface TierBadgeProps {
  tier: TrustTier;
  className?: string;
}

const TIER_FILL: Record<TrustTier, string> = {
  T1: 'bg-slate-50 text-slate-600 border-slate-300',
  T2: 'bg-slate-200 text-slate-700 border-slate-400',
  T3: 'bg-slate-700 text-slate-50 border-slate-800',
  T4: 'bg-slate-950 text-slate-50 border-slate-950',
};

export function TierBadge({ tier, className }: TierBadgeProps) {
  return (
    <span
      data-slot="tier-badge"
      data-tier={tier}
      title={TIER_LABELS[tier]}
      className={cn(
        'inline-flex items-center border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider',
        TIER_FILL[tier],
        className,
      )}
    >
      {tier}
    </span>
  );
}
