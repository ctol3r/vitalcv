import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import type { ClaimLevel } from '@/components/trust-state/types';

const claimBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
  {
    variants: {
      level: {
        L0: 'border border-dashed border-[var(--claim-l0)] text-[var(--claim-l0-foreground)] bg-transparent',
        L1: 'bg-[var(--claim-l1)] text-[var(--claim-l1-foreground)] animate-badge-pulse',
        L2: 'bg-[var(--claim-l2)] text-[var(--claim-l2-foreground)]',
        L3: 'bg-[var(--claim-l3)] text-[var(--claim-l3-foreground)]',
      },
    },
    defaultVariants: {
      level: 'L0',
    },
  },
);

const LEVEL_LABELS: Record<ClaimLevel, string> = {
  L0: 'Unverified',
  L1: 'Self-Attested',
  L2: 'Electronically Verified',
  L3: 'Primary Source Verified',
};

interface ClaimBadgeProps
  extends React.ComponentProps<'span'>,
    VariantProps<typeof claimBadgeVariants> {
  level: ClaimLevel;
  showLabel?: boolean;
}

function ClaimBadge({
  className,
  level,
  showLabel = true,
  ...props
}: ClaimBadgeProps) {
  return (
    <span
      data-slot="claim-badge"
      data-level={level}
      role="status"
      aria-label={`Verification level: ${LEVEL_LABELS[level]}`}
      className={cn(claimBadgeVariants({ level }), className)}
      {...props}
    >
      {/* L3 checkmark icon */}
      {level === 'L3' && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          <path
            d="M10 3L4.5 8.5L2 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {showLabel && LEVEL_LABELS[level]}
    </span>
  );
}

export { ClaimBadge, claimBadgeVariants, LEVEL_LABELS };
export type { ClaimBadgeProps };
