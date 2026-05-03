import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  Check,
  Clock,
  GitBranch,
  Info,
  Lock,
  Minus,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * LaneState — credential-readiness vocabulary.
 *
 * Distinct from severity (how dangerous a fact is) and risk (how
 * dangerous an actor is). LaneState describes what the system has
 * *done* about a fact — checked it, can't reach it, found a conflict.
 *
 * `unknown` deliberately reads as neutral: missing data is not a
 * negative signal, it's "not yet checked".
 */
export type LaneState =
  | 'verified'
  | 'pending'
  | 'access'
  | 'blocked'
  | 'contradicted'
  | 'unknown'
  | 'info';

interface LaneStateMeta {
  label: string;
  glyph: string;
  Icon: LucideIcon;
  description: string;
}

export const LANE_STATE_META: Record<LaneState, LaneStateMeta> = {
  verified: {
    label: 'Checked',
    glyph: '✔',
    Icon: Check,
    description: 'Confirmed against a primary source of truth.',
  },
  pending: {
    label: 'Pending',
    glyph: '⏳',
    Icon: Clock,
    description: 'Verification is in flight; result expected shortly.',
  },
  access: {
    label: 'Access Required',
    glyph: '🔒',
    Icon: Lock,
    description: 'Authorization needed before this lane can be checked.',
  },
  blocked: {
    label: 'Blocked',
    glyph: '✕',
    Icon: X,
    description: 'A blocking condition prevents acceptance.',
  },
  contradicted: {
    label: 'Contradicted',
    glyph: '⑂',
    Icon: GitBranch,
    description: 'Two authoritative sources disagree; reconciliation required.',
  },
  unknown: {
    label: 'Not checked',
    glyph: '·',
    Icon: Minus,
    description: 'Data not on file. Not a negative signal.',
  },
  info: {
    label: 'Info',
    glyph: 'i',
    Icon: Info,
    description: 'Advisory context.',
  },
};

const laneStateBadgeVariants = cva(
  [
    'inline-flex items-center',
    'rounded-full ring-1 ring-inset whitespace-nowrap',
    'font-medium uppercase tracking-[0.06em]',
    // Bridge transition with the system curve so chip color shifts feel
    // continuous with surrounding lane-row state changes.
    'transition-colors duration-[var(--vt-motion-fast)] ease-[var(--vt-ease-standard)]',
  ].join(' '),
  {
    variants: {
      state: {
        verified:
          'bg-[color-mix(in_oklab,var(--vt-state-verified)_14%,transparent)] text-[var(--vt-state-verified)] ring-[color-mix(in_oklab,var(--vt-state-verified)_28%,transparent)]',
        pending:
          'bg-[color-mix(in_oklab,var(--vt-state-pending)_14%,transparent)] text-[var(--vt-state-pending)] ring-[color-mix(in_oklab,var(--vt-state-pending)_28%,transparent)]',
        access:
          'bg-[color-mix(in_oklab,var(--vt-state-access)_14%,transparent)] text-[var(--vt-state-access)] ring-[color-mix(in_oklab,var(--vt-state-access)_28%,transparent)]',
        blocked:
          'bg-[color-mix(in_oklab,var(--vt-state-blocked)_14%,transparent)] text-[var(--vt-state-blocked)] ring-[color-mix(in_oklab,var(--vt-state-blocked)_28%,transparent)]',
        contradicted:
          'bg-[color-mix(in_oklab,var(--vt-state-contradicted)_14%,transparent)] text-[var(--vt-state-contradicted)] ring-[color-mix(in_oklab,var(--vt-state-contradicted)_28%,transparent)]',
        unknown:
          'bg-[color-mix(in_oklab,var(--vt-state-unknown)_14%,transparent)] text-[var(--vt-state-unknown)] ring-[color-mix(in_oklab,var(--vt-state-unknown)_28%,transparent)]',
        info:
          'bg-[color-mix(in_oklab,var(--vt-state-unknown)_10%,transparent)] text-[var(--vt-text-secondary)] ring-[color-mix(in_oklab,var(--vt-state-unknown)_22%,transparent)]',
      },
      size: {
        sm: 'text-[10.5px] px-1.5 py-0.5 gap-1',
        md: 'text-[11px] px-2 py-0.5 gap-1.5',
        lg: 'text-[12px] px-2.5 py-1 gap-1.5',
      },
    },
    defaultVariants: { state: 'unknown', size: 'md' },
  },
);

export interface LaneStateBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'title'>,
    Omit<VariantProps<typeof laneStateBadgeVariants>, 'state'> {
  state: LaneState;
  /** Override the auto-derived label (defaults to LANE_STATE_META[state].label). */
  label?: React.ReactNode;
  /** When false, suppresses the leading icon / pulse dot. */
  withIcon?: boolean;
  /** Override the native title tooltip (defaults to the state's description). */
  title?: string;
}

export function LaneStateBadge({
  state,
  size,
  label,
  withIcon = true,
  title,
  className,
  ...props
}: LaneStateBadgeProps) {
  const meta = LANE_STATE_META[state];
  const Icon = meta.Icon;
  const iconSize = size === 'sm' ? 11 : size === 'lg' ? 13 : 12;

  return (
    <span
      title={title ?? meta.description}
      className={cn(laneStateBadgeVariants({ state, size }), className)}
      {...props}
    >
      {withIcon && state === 'pending' && (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-current pulse-soft"
        />
      )}
      {withIcon && state !== 'pending' && (
        <Icon size={iconSize} strokeWidth={2.25} aria-hidden="true" />
      )}
      <span>{label ?? meta.label}</span>
    </span>
  );
}

export { laneStateBadgeVariants };
