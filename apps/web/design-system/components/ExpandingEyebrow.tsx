'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * ExpandingEyebrow — the section label that pins while its section is being read.
 *
 * Reference: measured on checkr.com, 2026-08-01 (see
 * `docs/design/reference-experience-atlas.md` §R5). Checkr ships 16 sticky
 * elements, five of them `TabsBlock-label` at `top: auto` — scroll-linked
 * section labels that pin as their block passes. The founder directive
 * attributes "expanding eyebrows" to Zoox; the harvest found Zoox running just
 * ONE sticky element site-wide, and Checkr actually implementing the pattern.
 * So the behaviour is adopted from the site that has it, not the one it was
 * credited to.
 *
 * Why this is `position: sticky` and not a scroll handler:
 *
 *   `R8` in `scripts/check-design-lint.ts` is an ERROR-mode rule — no second
 *   page-level scroll owner, no `wheel`/`touchmove`/`onWheel`. CD-11 gives a
 *   page exactly one scroll driver. Sticky positioning is pure CSS: it costs no
 *   listener, no rAF, and no JS at all, so this composes onto any surface
 *   including the homepage without touching its scroll ownership.
 *
 * The "expanding" half is a single-shot disclosure on hover/focus, not a
 * scroll-scrubbed animation. CD-11: an element reveals once and stays; nothing
 * idles; displacement is capped at 8px; `prefers-reduced-motion` keeps all
 * meaning and drops the transition. The detail is always in the DOM and always
 * reachable by keyboard and screen reader — the expansion is enrichment, never
 * the carrier of meaning (CD-2.3).
 *
 * ---------------------------------------------------------------------------
 * 2026-08-02 — CANONICAL. This is now the only eyebrow in the product.
 *
 * `components/home/ExpandingEyebrow.tsx` was a second, independent
 * implementation of the same intent — a frosted-glass pill whose trigger stood
 * 20px against CD-15's 44px floor, and whose detail was a `nowrap` strip capped
 * at 16rem. It shipped on `/` while this one was reachable only from a test.
 * The homepage recovery (#1060) resolved the duplicate here, in the direction
 * the accessibility floor demanded, and ported the two behaviours the home
 * version had that this one lacked:
 *
 *   1. Escape closes and returns the trigger to a resting state.
 *   2. A hydration guard, which is load-bearing rather than cosmetic — see below.
 */
export interface ExpandingEyebrowProps {
  /** The label. Rendered mono + uppercase per CD-9's `eyebrow` token. */
  children: React.ReactNode;
  /**
   * Optional detail revealed on hover/focus. Omit for a plain pinned label.
   * Always rendered — visibility is progressive, presence is not.
   */
  detail?: React.ReactNode;
  /** Pin to the top of the scroll container while its section is in view. */
  sticky?: boolean;
  /** Offset from the top when sticky, in px. Clears a fixed header. */
  stickyOffset?: number;
  className?: string;
}

export function ExpandingEyebrow({
  children,
  detail,
  sticky = false,
  stickyOffset = 0,
  className,
}: ExpandingEyebrowProps) {
  const [open, setOpen] = useState(false);
  /**
   * Until JS runs, the detail renders PLAINLY VISIBLE.
   *
   * The collapsed state is `opacity-0`, and `open` can only ever become true
   * through a client event — so without this guard the server render, and every
   * no-JS visitor, got a detail that was present in the DOM and invisible on
   * screen. CD-2.3 requires meaning to survive with JS off, and the recovery
   * program requires that no required content start at opacity zero. Gating the
   * collapse on hydration is what makes the disclosure genuinely progressive:
   * enrichment when JS is available, plain text when it is not.
   */
  const [hydrated, setHydrated] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const detailId = useId();

  useEffect(() => setHydrated(true), []);

  return (
    <div
      className={cn(
        'flex flex-col gap-[var(--vt-space-4)]',
        // CD-10: 0 radius. An eyebrow is structure, not a stamp and not a pill.
        // A hairline rule does the separating — CD's primary structural device.
        'border-l-2 border-[var(--vt-border)] pl-[var(--vt-space-12)]',
        sticky && 'sticky z-10',
        className,
      )}
      style={sticky ? { top: stickyOffset } : undefined}
      data-hydrated={hydrated ? '' : undefined}
      onMouseEnter={detail ? () => setOpen(true) : undefined}
      onMouseLeave={detail ? () => setOpen(false) : undefined}
    >
      <p
        className={cn(
          // CD-9 `eyebrow`: mono 500, 0.08em tracking, uppercase.
          'font-[var(--vt-font-mono,ui-monospace)] text-[0.6875rem] uppercase leading-[1.3]',
          'tracking-[0.08em] text-[var(--vt-text-muted)]',
          'm-0',
        )}
      >
        {detail ? (
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={open}
            aria-controls={detailId}
            onClick={() => setOpen((v) => !v)}
            onFocus={() => setOpen(true)}
            // Escape is the expected exit from any disclosure. Blurring as well
            // stops focus-reopen from immediately undoing the close.
            onKeyDown={(event) => {
              if (event.key === 'Escape' && open) {
                event.stopPropagation();
                setOpen(false);
                triggerRef.current?.blur();
              }
            }}
            className={cn(
              // CD-15: 44px minimum target, visible focus, never `outline: none`.
              'inline-flex min-h-11 items-center gap-[var(--vt-space-8)] text-left uppercase tracking-[0.08em]',
              'rounded-[3px] bg-transparent p-0 text-inherit',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vt-focus-ring)]',
            )}
          >
            {children}
            <span
              aria-hidden="true"
              className={cn(
                'inline-block text-[0.75em] transition-transform duration-[120ms]',
                'motion-reduce:transition-none',
                open && 'rotate-90',
              )}
            >
              ›
            </span>
          </button>
        ) : (
          children
        )}
      </p>

      {detail ? (
        <div
          id={detailId}
          // Not `hidden`: the detail stays in the accessibility tree and in the
          // no-JS render. Only its presentation changes. Removing it on collapse
          // would make hover the carrier of meaning, which CD-2.3 forbids.
          className={cn(
            'max-w-[62ch] text-[0.8125rem] leading-[1.5] text-[var(--vt-text-secondary)]',
            'transition-[opacity,transform] duration-[240ms] ease-[cubic-bezier(0.2,0.7,0.2,1)]',
            // Displacement capped at 8px (CD-11). Opacity-only under reduced motion.
            'motion-reduce:transition-none motion-reduce:transform-none',
            hydrated && !open
              ? '-translate-y-1 opacity-0 motion-reduce:opacity-100'
              : 'translate-y-0 opacity-100',
          )}
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
}
