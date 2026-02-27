'use client';

import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import type { CredentialState } from '@/types/holder';

/* ------------------------------------------------------------------ */
/*  StatusPill — high-visibility credential state indicator             */
/* ------------------------------------------------------------------ */

const statusPillVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold transition-colors',
  {
    variants: {
      state: {
        valid:
          'bg-[var(--trust-green)]/15 text-[var(--trust-green)]',
        expiring:
          'bg-[var(--trust-yellow)]/15 text-[var(--trust-yellow)]',
        revoked:
          'bg-[var(--trust-red)]/15 text-[var(--trust-red)]',
      },
    },
    defaultVariants: {
      state: 'valid',
    },
  },
);

const DOT_COLORS: Record<CredentialState, string> = {
  valid: 'bg-[var(--trust-green)]',
  expiring: 'bg-[var(--trust-yellow)]',
  revoked: 'bg-[var(--trust-red)]',
};

const STATE_LABELS: Record<CredentialState, string> = {
  valid: 'Valid',
  expiring: 'Expiring',
  revoked: 'Revoked',
};

interface StatusPillProps
  extends Omit<React.ComponentProps<'span'>, 'children'>,
    VariantProps<typeof statusPillVariants> {
  state: CredentialState;
}

export function StatusPill({ state, className, ...props }: StatusPillProps) {
  return (
    <span
      data-slot="status-pill"
      role="status"
      aria-label={`Credential status: ${STATE_LABELS[state]}`}
      className={cn(statusPillVariants({ state }), className)}
      {...props}
    >
      <span
        className={cn('h-2 w-2 rounded-full shrink-0', DOT_COLORS[state])}
        aria-hidden="true"
      />
      {STATE_LABELS[state]}
    </span>
  );
}

export { statusPillVariants, STATE_LABELS };
export type { StatusPillProps };
