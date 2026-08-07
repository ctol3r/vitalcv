import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * NCQATag — surfaces NCQA Credentialing Standards (CR §3, CR §4.x)
 * coverage for a given lane or fact.
 *
 *   satisfied — lane meets the standard's evidence requirement
 *   pending   — verification underway
 *   access    — gated; PSV must be performed by employer/CVO
 *   na        — standard does not apply to this lane
 */
export type NCQAStatus = 'satisfied' | 'pending' | 'access' | 'na';

const NCQA_STATUS_LABEL: Record<NCQAStatus, string> = {
  satisfied: 'Satisfied',
  pending: 'Pending',
  access: 'Pending Access',
  na: 'N/A',
};

const ncqaTagVariants = cva(
  [
    'inline-flex items-center gap-1',
    'rounded ring-1 ring-inset whitespace-nowrap',
    'font-mono font-medium uppercase tracking-[0.08em]',
  ].join(' '),
  {
    variants: {
      status: {
        satisfied:
          'bg-[color-mix(in_oklab,var(--vt-state-source-confirmed)_12%,transparent)] text-[var(--vt-state-source-confirmed)] ring-[color-mix(in_oklab,var(--vt-state-source-confirmed)_24%,transparent)]',
        pending:
          'bg-[color-mix(in_oklab,var(--vt-state-pending)_12%,transparent)] text-[var(--vt-state-pending)] ring-[color-mix(in_oklab,var(--vt-state-pending)_24%,transparent)]',
        access:
          'bg-[color-mix(in_oklab,var(--vt-state-access)_12%,transparent)] text-[var(--vt-state-access)] ring-[color-mix(in_oklab,var(--vt-state-access)_24%,transparent)]',
        na:
          'bg-[var(--vt-surface-subtle)] text-[var(--vt-text-muted)] ring-[var(--vt-border-subtle)]',
      },
      size: {
        xs: 'text-[9.5px] px-1.5 py-[1px]',
        sm: 'text-[10px] px-1.5 py-[2px]',
      },
    },
    defaultVariants: { status: 'na', size: 'sm' },
  },
);

export interface NCQATagProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'title'>,
    Omit<VariantProps<typeof ncqaTagVariants>, 'status'> {
  /** NCQA standard code, e.g. "CR.3.A" or "CR.4.B". */
  code: string;
  status: NCQAStatus;
  /** Description used as the native tooltip; usually the standard's plain-English name. */
  description?: string;
}

export function NCQATag({
  code,
  status,
  size,
  description,
  className,
  ...props
}: NCQATagProps) {
  const statusLabel = NCQA_STATUS_LABEL[status];
  return (
    <span
      title={description ? `${code} — ${description}` : code}
      className={cn(ncqaTagVariants({ status, size }), className)}
      {...props}
    >
      <span>[{code}:</span>
      <span className="font-semibold">{statusLabel}</span>
      <span>]</span>
    </span>
  );
}

export { ncqaTagVariants };
