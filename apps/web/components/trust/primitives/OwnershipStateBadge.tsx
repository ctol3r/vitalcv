import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  OWNERSHIP_LABELS,
  type OwnershipState,
} from '@/lib/trust/institutional-language';

/**
 * Who asserted · 3 fixed values · subject · delegated · unbound.
 *
 * Source: Trust Primitives.html §04. "anonymous" and "guest" are banned
 * by the spec; this component cannot render them.
 */
export interface OwnershipStateBadgeProps {
  state: OwnershipState;
  className?: string;
}

const OWNERSHIP_DOT: Record<OwnershipState, string> = {
  subject: 'bg-slate-900',
  delegated: 'border border-slate-700 bg-transparent',
  unbound: 'border border-dashed border-slate-400 bg-transparent',
};

export function OwnershipStateBadge({
  state,
  className,
}: OwnershipStateBadgeProps) {
  return (
    <span
      data-slot="ownership-badge"
      data-ownership={state}
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-xs',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('inline-block h-2 w-2 rounded-full', OWNERSHIP_DOT[state])}
      />
      <span>{OWNERSHIP_LABELS[state]}</span>
    </span>
  );
}
