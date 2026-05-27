import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  AlertTriangle,
  Camera,
  Database,
  EyeOff,
  Inbox,
  Lock,
  PauseCircle,
  ScanLine,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * TruthStateChip — the canonical, product-vocabulary chip for "what is the
 * system reporting about this fact right now".
 *
 * Distinct from:
 *   - LaneStateBadge: the operations vocabulary for credential-readiness
 *     lanes (checked / pending / access / blocked / contradicted / unknown).
 *   - TrustTierBadge: the trust-tier axis (T1–T4) for the underlying source.
 *   - VerificationBadge / DecisionBadge / ExclusionBadge: domain-specific
 *     decision artefacts.
 *
 * TruthStateChip answers a single question: how should a viewer interpret
 * the *current* visible state of a source row, a passport field, or a
 * connector matrix entry? Every label is operator-honest and avoids the
 * banned vocabulary from CLAUDE.md (no bare "Verified", no
 * "guaranteed verification", no "instant credentialing", no claim of
 * final credentialing).
 */

/**
 * The eight operator-honest truth states. Identifiers are kebab-cased so
 * they can be passed verbatim from server props without transformation.
 */
export type TruthStateKind =
  | 'source-backed'
  | 'temporarily-unavailable'
  | 'connector-not-live'
  | 'access-required'
  | 'institution-review-required'
  | 'snapshot-only'
  | 'demo-only'
  | 'auth-required';

/**
 * Visual variant taxonomy — mirrors the existing Badge variants in this
 * design system so the chip slots into the same theme tokens.
 *   - neutral  : factual, restrained (source-backed, snapshot-only)
 *   - muted    : system condition, not a finding (temporarily-unavailable)
 *   - outline  : connector not live / awaiting review / demo / auth
 *   - warning  : caller action required (access-required)
 */
export type TruthStateVariant = 'neutral' | 'muted' | 'outline' | 'warning';

interface TruthStateMeta {
  /** Visible chip label. NEVER the bare word "Verified". */
  label: string;
  /** Sentence used in the legend; describes what the state means in plain
   *  operator language. */
  description: string;
  /** Visual treatment per Wave G spec. */
  variant: TruthStateVariant;
  Icon: LucideIcon;
  /**
   * The aria-label prefix used by assistive tech. Combined with the source
   * label (if any) into "Truth state: source-backed for NPPES". Always
   * uses the kebab-case key so the same prefix reads cleanly with or
   * without a source.
   */
  ariaPrefix: string;
}

export const TRUTH_STATE_META: Record<TruthStateKind, TruthStateMeta> = {
  'source-backed': {
    label: 'Source-backed',
    description: 'A primary source returned a usable payload for this field. Not a final credentialing decision.',
    variant: 'neutral',
    Icon: Database,
    ariaPrefix: 'Truth state: source-backed',
  },
  'temporarily-unavailable': {
    label: 'Temporarily unavailable',
    description: 'The source did not return a payload on this attempt. System condition, not a finding about the clinician.',
    variant: 'muted',
    Icon: PauseCircle,
    ariaPrefix: 'Truth state: temporarily unavailable',
  },
  'connector-not-live': {
    label: 'Connector not live',
    description: 'This connector is intentionally not running in the current build. Do not interpret as an exclusion clearance.',
    variant: 'outline',
    Icon: EyeOff,
    ariaPrefix: 'Truth state: connector not live',
  },
  'access-required': {
    label: 'Access required',
    description: 'Authorization is needed before this lane can be read. Caller action expected.',
    variant: 'warning',
    Icon: Lock,
    ariaPrefix: 'Truth state: access required',
  },
  'institution-review-required': {
    label: 'Institution review',
    description: 'This view is a reviewer-ready head start, not a final credentialing decision.',
    variant: 'outline',
    Icon: Inbox,
    ariaPrefix: 'Truth state: institution review required',
  },
  'snapshot-only': {
    label: 'Snapshot only',
    description: 'Point-in-time read; current state may have changed since the snapshot.',
    variant: 'neutral',
    Icon: Camera,
    ariaPrefix: 'Truth state: snapshot only',
  },
  'demo-only': {
    label: 'Demo only',
    description: 'Synthetic data for demonstration. Not a real source confirmation.',
    variant: 'outline',
    Icon: ScanLine,
    ariaPrefix: 'Truth state: demo only',
  },
  'auth-required': {
    label: 'Sign in to view',
    description: 'Operator sign-in unlocks the live read. Public passport pages remain readable without an account.',
    variant: 'outline',
    Icon: AlertTriangle,
    ariaPrefix: 'Truth state: sign-in required',
  },
};

const chipVariants = cva(
  [
    'inline-flex items-center gap-1.5',
    'rounded-[var(--vt-radius-pill)] border',
    'px-[var(--vt-space-12)] py-[var(--vt-space-4)]',
    'text-[length:var(--vt-type-caption-size)] leading-[var(--vt-line-tight)]',
    'font-[var(--vt-font-weight-semibold)] uppercase tracking-[0.12em]',
    'transition-[background-color,border-color,color] duration-[var(--vt-motion-fast)] ease-[var(--vt-ease-standard)]',
    'whitespace-nowrap',
  ].join(' '),
  {
    variants: {
      variant: {
        neutral:
          'border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] text-[var(--vt-text-secondary)]',
        muted:
          'border-[var(--vt-border-subtle,var(--vt-border))] bg-transparent text-[var(--vt-text-tertiary,var(--vt-text-secondary))] opacity-90',
        outline:
          'border-[var(--vt-border)] bg-transparent text-[var(--vt-text-secondary)]',
        warning:
          'border-transparent bg-[var(--vt-severity-medium)]/15 text-[var(--vt-severity-medium)]',
      },
      size: {
        sm: 'gap-1 px-[var(--vt-space-8)] py-[var(--vt-space-2)] text-[10px] tracking-[0.16em]',
        md: '',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  },
);

export interface TruthStateChipProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'aria-label'>,
    VariantProps<typeof chipVariants> {
  /** The truth state to display. */
  state: TruthStateKind;
  /**
   * Optional source identifier appended to the aria-label for context
   * (e.g. "NPPES"). Never shown visually inside the chip itself.
   */
  sourceLabel?: string;
  /**
   * Optional ISO timestamp. If provided, rendered after the chip text
   * inside a `<time>` element for screen readers. Visually, the chip
   * stays concise; timestamps are surfaced by the *row*, not the chip.
   * Provided here so call sites that want a fully-self-describing chip
   * (e.g. tooltips) can opt in.
   */
  timestamp?: string;
  /** Override the default visual variant. Use sparingly. */
  variant?: TruthStateVariant;
  /** Override the default size. Defaults to `md`. */
  size?: 'sm' | 'md';
  /** Optional override for the visible label. Caller is responsible for
   *  copy review (banned-strings list). */
  label?: string;
}

/**
 * Render the canonical chip for a given truth state.
 *
 * Visual treatment is determined by `TRUTH_STATE_META[state].variant`
 * unless the caller overrides via the `variant` prop.
 */
export function TruthStateChip({
  state,
  sourceLabel,
  timestamp,
  variant,
  size,
  label,
  className,
  ...rest
}: TruthStateChipProps) {
  const meta = TRUTH_STATE_META[state];
  const visibleLabel = label ?? meta.label;
  const ariaLabel = sourceLabel
    ? `${meta.ariaPrefix} for ${sourceLabel}`
    : meta.ariaPrefix;

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      data-truth-state={state}
      className={cn(
        chipVariants({ variant: variant ?? meta.variant, size }),
        className,
      )}
      {...rest}
    >
      <meta.Icon aria-hidden="true" className="h-3 w-3" />
      <span>{visibleLabel}</span>
      {timestamp && (
        <time dateTime={timestamp} className="sr-only">
          {timestamp}
        </time>
      )}
    </span>
  );
}

/**
 * The eight states in operator-friendly default order. Useful for
 * legend rendering and story/test enumeration.
 */
export const TRUTH_STATE_ORDER: ReadonlyArray<TruthStateKind> = Object.freeze([
  'source-backed',
  'snapshot-only',
  'institution-review-required',
  'access-required',
  'auth-required',
  'temporarily-unavailable',
  'connector-not-live',
  'demo-only',
] as const);
