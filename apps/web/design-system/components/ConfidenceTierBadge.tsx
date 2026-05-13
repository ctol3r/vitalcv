import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * ConfidenceTier — field-level confidence vocabulary.
 *
 * `verified`     — checked against a primary source of truth.
 * `inferred`     — derived from clinician-supplied docs by AI; not PSV.
 * `unknown`      — data not on file. Not a negative signal.
 * `contradicted` — two authoritative sources disagree; reconciliation needed.
 *
 * Sibling to the legacy `ConfidenceBadge` (which takes a numeric 0-1 score
 * and is used by the intelligence/risk surfaces). Use this one for the
 * credential-readiness vocabulary surfaces (passport, employer, dossier).
 */
export type ConfidenceTier = 'verified' | 'inferred' | 'unknown' | 'contradicted';

interface ConfidenceTierMeta {
  label: string;
  glyph: string;
  description: string;
}

export const CONFIDENCE_TIER_META: Record<ConfidenceTier, ConfidenceTierMeta> = {
  verified: {
    label: 'High-confidence tier',
    glyph: '✔',
    description: 'Checked against a primary source of truth.',
  },
  inferred: {
    label: 'Inferred',
    glyph: '≈',
    description:
      'Derived by AI from clinician-supplied documents. Not primary-source verified.',
  },
  unknown: {
    label: 'Unknown',
    glyph: '⚠',
    description: 'Data not on file. Not a negative signal.',
  },
  contradicted: {
    label: 'Contradicted',
    glyph: '⑂',
    description: 'Two authoritative sources disagree. Requires human reconciliation.',
  },
};

const confidenceTierBadgeVariants = cva(
  [
    'inline-flex items-center gap-1',
    'rounded ring-1 ring-inset whitespace-nowrap',
    'font-medium uppercase tracking-[0.08em]',
  ].join(' '),
  {
    variants: {
      tier: {
        verified:
          'bg-[color-mix(in_oklab,var(--vt-state-verified)_12%,transparent)] text-[var(--vt-state-verified)] ring-[color-mix(in_oklab,var(--vt-state-verified)_24%,transparent)]',
        inferred:
          'bg-[color-mix(in_oklab,var(--vt-state-unknown)_10%,transparent)] text-[var(--vt-text-secondary)] ring-[color-mix(in_oklab,var(--vt-state-unknown)_22%,transparent)]',
        unknown:
          'bg-[var(--vt-surface)] text-[var(--vt-state-pending)] ring-[color-mix(in_oklab,var(--vt-state-pending)_36%,transparent)]',
        contradicted:
          'bg-[color-mix(in_oklab,var(--vt-state-contradicted)_12%,transparent)] text-[var(--vt-state-contradicted)] ring-[color-mix(in_oklab,var(--vt-state-contradicted)_24%,transparent)]',
      },
      size: {
        xs: 'text-[9.5px] px-1.5 py-[1px]',
        sm: 'text-[10.5px] px-1.5 py-[2px]',
        md: 'text-[11px] px-2 py-[3px]',
      },
    },
    defaultVariants: { tier: 'inferred', size: 'sm' },
  },
);

export interface ConfidenceTierBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'title'>,
    Omit<VariantProps<typeof confidenceTierBadgeVariants>, 'tier'> {
  tier: ConfidenceTier;
  showLabel?: boolean;
  title?: string;
}

export function ConfidenceTierBadge({
  tier,
  size,
  showLabel = true,
  title,
  className,
  ...props
}: ConfidenceTierBadgeProps) {
  const meta = CONFIDENCE_TIER_META[tier];
  return (
    <span
      title={title ?? meta.description}
      className={cn(confidenceTierBadgeVariants({ tier, size }), className)}
      {...props}
    >
      <span className="font-mono leading-none">{meta.glyph}</span>
      {showLabel && <span>{meta.label}</span>}
    </span>
  );
}

export { confidenceTierBadgeVariants };
