import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * TierBadge — canonical T1–T4 trust tier rendering.
 *
 * Tier doctrine:
 *   T1 — self-asserted / unverified
 *   T2 — AI/automated cross-check, no primary-source verification
 *   T3 — source-checked (NPPES, OIG, state board PSV)
 *   T4 — cryptographically signed receipt issued by an authoritative
 *        issuer with active signing keys
 *
 * Special states (not tiers, but band-equivalent indicators):
 *   DEGRADED          — best-known tier may be lower than usual
 *                       because at least one source is degraded
 *   UNAVAILABLE       — tier cannot be computed; data not yet present
 *   UNSIGNED          — would be T4 but the receipt is not currently
 *                       signed (e.g. signer key rotated, awaiting re-sign)
 *   ISSUER_UNREACHABLE— signing chain exists but the issuer endpoint
 *                       is presently unreachable for verification
 */
export type TierValue = 'T1' | 'T2' | 'T3' | 'T4';
export type TierSpecialState =
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'UNSIGNED'
  | 'ISSUER_UNREACHABLE';

export type TierBadgeKind = TierValue | TierSpecialState;

const TIER_COPY: Record<TierBadgeKind, { label: string; sublabel: string }> = {
  T1: { label: 'T1', sublabel: 'Self-asserted' },
  T2: { label: 'T2', sublabel: 'AI cross-check' },
  T3: { label: 'T3', sublabel: 'Source-checked' },
  T4: { label: 'T4', sublabel: 'Signed receipt' },
  DEGRADED: { label: 'T—', sublabel: 'Degraded' },
  UNAVAILABLE: { label: 'T?', sublabel: 'Unavailable' },
  UNSIGNED: { label: 'T4*', sublabel: 'Unsigned' },
  ISSUER_UNREACHABLE: { label: 'T4*', sublabel: 'Issuer unreachable' },
};

const TIER_CLASSES: Record<TierBadgeKind, string> = {
  // Real tiers — solid color tokens
  T1: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
  T2: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  T3: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  T4: 'border-emerald-600/40 bg-emerald-600/15 text-emerald-800 dark:text-emerald-200',
  // Special states — distinct visual treatment so they never read as a tier
  DEGRADED: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  UNAVAILABLE: 'border-dashed border-zinc-400/40 bg-transparent text-zinc-500 dark:text-zinc-400',
  UNSIGNED: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  ISSUER_UNREACHABLE: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
};

export type TierBadgeSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<TierBadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1.5 gap-2',
};

export interface TierBadgeProps {
  tier: TierBadgeKind;
  size?: TierBadgeSize;
  /** Show the descriptive sublabel ("Self-asserted", etc.). Default true. */
  showSublabel?: boolean;
  className?: string;
}

export function TierBadge({
  tier,
  size = 'md',
  showSublabel = true,
  className,
}: TierBadgeProps): React.ReactElement {
  const copy = TIER_COPY[tier];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border font-mono uppercase tracking-wide',
        TIER_CLASSES[tier],
        SIZE_CLASSES[size],
        className,
      )}
      data-tier={tier}
      role="status"
    >
      <span className="font-semibold">{copy.label}</span>
      {showSublabel && (
        <span className="font-normal normal-case opacity-80">{copy.sublabel}</span>
      )}
    </span>
  );
}
