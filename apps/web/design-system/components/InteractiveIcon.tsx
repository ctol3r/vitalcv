'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

/**
 * InteractiveIcon — an icon that is also a real control.
 *
 * Two constraints shaped this, and both are enforced:
 *
 *  1. `LINT-02` (`scripts/check-design-lint.ts`) — the glyph set is CLOSED. No
 *     raw `lucide-react` import outside the sanctioned icon module, and the
 *     rule is a ratchet, so a new import raises the count and fails the gate.
 *     This composes {@link Icon}, which already owns the only lucide type
 *     import in the library, and takes the glyph as a prop. Zero new imports.
 *  2. Truth-state iconography is `TrustGlyph`/`ProvenanceChip` ONLY. An icon
 *     here is chrome — it may label an action, never assert a fact. There is
 *     deliberately no `state` prop, so this cannot become a thirty-second badge.
 *
 * CD-2.2: an icon never carries meaning alone. `label` is REQUIRED, and it is
 * either rendered beside the glyph or attached as the accessible name — the
 * component cannot be constructed without one. That is the same reasoning as
 * `LINT-10` (glyph without label in a chip), expressed at the type level
 * instead of as a lint rule.
 *
 * CD-11: state-change motion only, 120ms, nothing idles. CD-15: 44px target and
 * a visible focus ring.
 */
export interface InteractiveIconProps {
  /** The glyph. Passed in so no new `lucide-react` import lands here (LINT-02). */
  icon: LucideIcon;
  /** Required. Rendered, or used as the accessible name when `showLabel` is false. */
  label: string;
  /** Show the label beside the glyph. Default true — CD-2.2 prefers word + glyph. */
  showLabel?: boolean;
  onClick?: () => void;
  /** Renders as a link when set. */
  href?: string;
  disabled?: boolean;
  className?: string;
}

export function InteractiveIcon({
  icon,
  label,
  showLabel = true,
  onClick,
  href,
  disabled,
  className,
}: InteractiveIconProps) {
  const classes = cn(
    'inline-flex min-h-11 min-w-11 items-center justify-center gap-[var(--vt-space-8)]',
    // CD-10: a control is software → 10px. Never a pill.
    'rounded-[10px] px-[var(--vt-space-8)]',
    'text-[0.8125rem] leading-[1.4] text-[var(--vt-text-secondary)]',
    // CD-11: --dur-state 120ms, state change only. No idle, no pulse, no shimmer.
    'transition-colors duration-[120ms] motion-reduce:transition-none',
    'hover:bg-[var(--vt-surface-subtle)] hover:text-[var(--vt-text-primary)]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vt-focus-ring)]',
    disabled && 'pointer-events-none opacity-50',
    className,
  );

  const inner = (
    <>
      <Icon icon={icon} className="h-4 w-4 shrink-0" />
      {showLabel ? <span>{label}</span> : null}
    </>
  );

  if (href) {
    return (
      <a href={href} className={classes} aria-label={showLabel ? undefined : label}>
        {inner}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={classes}
      aria-label={showLabel ? undefined : label}
    >
      {inner}
    </button>
  );
}
