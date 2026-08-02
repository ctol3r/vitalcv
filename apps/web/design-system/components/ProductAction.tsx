'use client';

import { cn } from '@/lib/utils';

/**
 * ProductAction — the one primary action on a screen.
 *
 * CD-14 gives a workspace screen "one primary action". This is that control,
 * and it exists separately from {@link Button} because it carries the extra
 * obligations the reference harvest showed everyone else failing:
 *
 *  - **44px, always** (CD-15). Measured 2026-08-01, ALL FOURTEEN reference
 *    sites fail this floor on desktop, from 19% of targets (Zocdoc) to 98%
 *    (OpenEvidence); Medallion fails 57 of 79 at 375px. VitalCV's own homepage
 *    was 20 of 24 before this wave. The floor is not optional here — it is the
 *    height, not a minimum a caller can undercut with padding utilities.
 *  - **The accent is indigo** (CD-4), never a state hue. Green means one thing:
 *    a named source returned a match. Spending it on a button destroys that.
 *  - **`consequence` is stated, not implied.** An action that sends evidence to
 *    a named employer says so beneath itself. CD-1: design does not decorate a
 *    claim into being stronger, and it does not hide what a click will do.
 *
 * CD-11: no idle motion, no count-up, no celebration on success. The `pending`
 * state changes the WORD, not a spinner — an infinite spinner is idle motion on
 * an evidence surface, which the motion doctrine already had to remove once.
 */
export interface ProductActionProps {
  children: React.ReactNode;
  /** What this will actually do, in plain words. Rendered beneath the control. */
  consequence?: string;
  variant?: 'primary' | 'secondary';
  /** In flight. Changes the word and disables — never spins (CD-11). */
  pending?: boolean;
  pendingLabel?: string;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  type?: 'button' | 'submit';
  className?: string;
}

export function ProductAction({
  children,
  consequence,
  variant = 'primary',
  pending = false,
  pendingLabel = 'Working…',
  disabled,
  onClick,
  href,
  type = 'button',
  className,
}: ProductActionProps) {
  const isDisabled = disabled || pending;

  const classes = cn(
    'inline-flex min-h-11 items-center justify-center gap-[var(--vt-space-8)]',
    // CD-10: software → 10px.
    'rounded-[10px] px-[var(--vt-space-16)]',
    'text-[0.9375rem] font-[var(--vt-font-weight-medium)] leading-[1.4]',
    'transition-colors duration-[120ms] motion-reduce:transition-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vt-focus-ring)]',
    variant === 'primary'
      ? 'bg-[var(--vt-accent)] text-[var(--vt-surface)] hover:bg-[var(--vt-accent-hover)]'
      : 'border border-[var(--vt-border)] bg-transparent text-[var(--vt-text-primary)] hover:bg-[var(--vt-surface-subtle)]',
    isDisabled && 'pointer-events-none opacity-60',
    className,
  );

  const label = pending ? pendingLabel : children;

  return (
    <span className="inline-flex flex-col items-start gap-[var(--vt-space-4)]">
      {href && !isDisabled ? (
        <a href={href} className={classes}>
          {label}
        </a>
      ) : (
        <button
          type={type}
          onClick={onClick}
          disabled={isDisabled}
          // The word changes; assistive tech is told the region is busy. No
          // spinner: idle motion on an evidence surface is forbidden (CD-11).
          aria-busy={pending || undefined}
          className={classes}
        >
          {label}
        </button>
      )}

      {consequence ? (
        <span className="max-w-[62ch] text-[0.8125rem] leading-[1.5] text-[var(--vt-text-muted)]">
          {consequence}
        </span>
      ) : null}
    </span>
  );
}
