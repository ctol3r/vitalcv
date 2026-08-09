import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * TrustTier — published authority ladder (prototype Wave 7).
 *
 *   T1 — Self-asserted          (clinician-typed, no verification)
 *   T2 — AI-inferred            (derived from clinician-uploaded artifacts)
 *   T3 — Source-checked         (federal/state registry primary-source verified)
 *   T4 — Issuer-signed          (cryptographically signed by issuing authority)
 *
 * Every fact rendered on the passport carries a tier so downstream
 * verifiers know exactly how much trust to extend.
 */
export type TrustTier = 'T1' | 'T2' | 'T3' | 'T4';

interface TrustTierMeta {
  label: string;
  shortLabel: string;
  description: string;
  /** Authority example surfaced in tooltips. */
  example: string;
}

export const TRUST_TIER_META: Record<TrustTier, TrustTierMeta> = {
  T1: {
    label: 'T1 · Self-asserted',
    shortLabel: 'T1',
    description: 'Clinician-typed; no third-party verification.',
    example: 'e.g. clinician-entered employment history',
  },
  T2: {
    label: 'T2 · AI-inferred',
    shortLabel: 'T2',
    description: 'Extracted by AI from clinician-supplied artifacts.',
    example: 'e.g. residency dates parsed from a CV',
  },
  T3: {
    label: 'T3 · Source-checked',
    shortLabel: 'T3',
    description: 'Confirmed against an authoritative registry (federal or state).',
    // NPDB removed: it is not integrated, so listing it as an authority this
    // tier is "confirmed against" was a confirmed mark on a non-integrated
    // source — the exact thing EC-3 forbids — on top of the customer-facing
    // noun ban. The three that remain are read for real.
    example: 'e.g. NPPES, OIG/LEIE, CMS PECOS',
  },
  T4: {
    label: 'T4 · Issuer-signed',
    shortLabel: 'T4',
    description: 'Cryptographically signed by the issuing authority. No further verification required.',
    example: 'e.g. board-issued VC 2.0 receipt',
  },
};

const trustTierBadgeVariants = cva(
  [
    'inline-flex items-center gap-1.5',
    'rounded ring-1 ring-inset whitespace-nowrap',
    'font-medium uppercase tracking-[0.1em] font-mono',
  ].join(' '),
  {
    variants: {
      tier: {
        T1: 'bg-[var(--vt-surface-subtle)] text-[var(--vt-text-muted)] ring-[var(--vt-border-subtle)]',
        T2: 'bg-[color-mix(in_oklab,var(--vt-state-unknown)_12%,transparent)] text-[var(--vt-text-secondary)] ring-[color-mix(in_oklab,var(--vt-state-unknown)_24%,transparent)]',
        T3: 'bg-[color-mix(in_oklab,var(--vt-state-source-confirmed)_12%,transparent)] text-[var(--vt-state-source-confirmed)] ring-[color-mix(in_oklab,var(--vt-state-source-confirmed)_24%,transparent)]',
        T4: 'bg-[color-mix(in_oklab,var(--vt-state-access)_14%,transparent)] text-[var(--vt-state-access)] ring-[color-mix(in_oklab,var(--vt-state-access)_28%,transparent)]',
      },
      size: {
        xs: 'text-[9.5px] px-1.5 py-[1px]',
        sm: 'text-[10.5px] px-1.5 py-[2px]',
        md: 'text-[11px] px-2 py-[3px]',
      },
    },
    defaultVariants: { tier: 'T2', size: 'sm' },
  },
);

export interface TrustTierBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'title'>,
    Omit<VariantProps<typeof trustTierBadgeVariants>, 'tier'> {
  tier: TrustTier;
  /** Render as the long form ("T3 · Source-checked") vs short ("T3"). */
  variant?: 'short' | 'long';
  title?: string;
}

export function TrustTierBadge({
  tier,
  size,
  variant = 'long',
  title,
  className,
  ...props
}: TrustTierBadgeProps) {
  const meta = TRUST_TIER_META[tier];
  return (
    <span
      title={title ?? `${meta.description} ${meta.example}`}
      className={cn(trustTierBadgeVariants({ tier, size }), className)}
      {...props}
    >
      {variant === 'long' ? meta.label : meta.shortLabel}
    </span>
  );
}

export { trustTierBadgeVariants };
