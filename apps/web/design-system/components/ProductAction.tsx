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
  /**
   * Render the trailing arrow that exchanges on hover and focus.
   *
   * The exchange is FINITE — one arrow leaves to the right as its replacement
   * arrives from the left, and then it is over. CD-11 forbids idle motion, so
   * this may never loop, and under `prefers-reduced-motion` the glyph simply
   * sits still: the arrow is decoration on a control that already says what it
   * does in words, so losing the movement costs no meaning.
   */
  arrow?: boolean;
  className?: string;
  /**
   * Data attributes are forwarded to the rendered control.
   *
   * Not a convenience: `data-home-primary-cta` is read by the homepage truth
   * tests and by `hero-employer-entry`, and a canonical action component that
   * cannot carry a marker forces callers back to a hand-rolled `<button>` —
   * which is exactly how a codebase ends up with thirteen CTA implementations.
   */
  [dataAttribute: `data-${string}`]: unknown;
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
  arrow = false,
  className,
  ...rest
}: ProductActionProps) {
  const isDisabled = disabled || pending;
  const dataProps = Object.fromEntries(
    Object.entries(rest).filter(([key]) => key.startsWith('data-')),
  );

  const classes = cn(
    'group inline-flex min-h-11 items-center justify-center gap-[var(--vt-space-8)]',
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

  /**
   * Two glyphs in a clipped track: the resting one leaves to the right, its
   * replacement arrives from the left. `aria-hidden` because the control's own
   * words carry the meaning — a screen reader must not hear "right arrow".
   */
  const arrowGlyph = arrow ? (
    <span
      aria-hidden="true"
      className="relative inline-block h-[1em] w-[0.9em] overflow-hidden align-middle"
    >
      <span
        className={cn(
          'absolute inset-0 transition-transform duration-[120ms] ease-[cubic-bezier(0.4,0,1,1)]',
          'group-hover:translate-x-full group-focus-visible:translate-x-full',
          'motion-reduce:transition-none motion-reduce:transform-none',
        )}
      >
        →
      </span>
      <span
        className={cn(
          '-translate-x-full absolute inset-0 transition-transform duration-[120ms] ease-[cubic-bezier(0.2,0.7,0.2,1)]',
          'group-hover:translate-x-0 group-focus-visible:translate-x-0',
          'motion-reduce:hidden',
        )}
      >
        →
      </span>
    </span>
  ) : null;

  return (
    <span className="inline-flex flex-col items-start gap-[var(--vt-space-4)]">
      {href && !isDisabled ? (
        <a href={href} className={classes} {...dataProps}>
          {label}
          {arrowGlyph}
        </a>
      ) : (
        <button
          type={type}
          onClick={onClick}
          disabled={isDisabled}
          {...dataProps}
          // The word changes; assistive tech is told the region is busy. No
          // spinner: idle motion on an evidence surface is forbidden (CD-11).
          aria-busy={pending || undefined}
          className={classes}
        >
          {label}
          {arrowGlyph}
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
