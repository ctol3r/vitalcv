'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  PANE_STACK_OFFSET_PX,
  PANE_WIDTH_REM,
  closePaneAt,
  parsePanes,
  pushPane,
  serializePanes,
  type PaneRef,
} from '@/lib/trust/panes';

/**
 * Stacked Provenance Ledger — URL-driven sliding panes.
 *
 * Inspired by Andy Matuschak's notes (https://notes.andymatuschak.org).
 * The stack is canonical state in the URL: open panes are listed in
 * `?panes=...`, the rightmost pane is the active one, panes scroll
 * horizontally, and the left edges of overflowed panes sticky-stack so
 * the user always sees the path they took.
 *
 * Visual contract (binding):
 * - dense, quiet, institutional (no shadows, no gradients, no animation
 *   beyond a fast linear horizontal slide)
 * - strict --ink-900 borders (rendered as `border-slate-900`)
 * - 40px sticky offset per stacked pane
 * - panes are fixed-width (32rem) so the index-card metaphor holds
 */
export interface StackedPaneLayoutProps {
  /**
   * Renderer for a single pane. Called once per pane in the URL stack.
   * The render context gives the caller the active index, the ability
   * to push a child pane, and the ability to close panes to the right.
   */
  renderPane: (ref: PaneRef, ctx: PaneRenderContext) => React.ReactNode;
  /**
   * Optional leftmost root pane that always renders. Useful when the
   * stack head is determined by the route (e.g. "the receipt you're
   * inspecting") rather than the URL.
   */
  rootPane?: PaneRef;
  /**
   * Optional renderer for the root pane. Required when `rootPane` is
   * provided.
   */
  renderRootPane?: (ctx: PaneRenderContext) => React.ReactNode;
  className?: string;
}

export interface PaneRenderContext {
  index: number;
  isActive: boolean;
  totalPanes: number;
  pushPane: (next: PaneRef) => void;
  closeThisPane: () => void;
}

/**
 * Internal hook — synchronises the `?panes=` search param with route
 * state. Mutations are router-pushed (not replaced) so the browser
 * back-button walks the user's exploration path.
 */
function usePaneStack(): {
  panes: readonly PaneRef[];
  pushFrom: (fromIndex: number, ref: PaneRef) => void;
  closeAt: (index: number) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const panes = React.useMemo(
    () => parsePanes(searchParams.get('panes')),
    [searchParams],
  );

  const navigate = React.useCallback(
    (next: readonly PaneRef[]) => {
      const params = new URLSearchParams(searchParams.toString());
      const serialized = serializePanes(next);
      if (serialized.length > 0) {
        params.set('panes', serialized);
      } else {
        params.delete('panes');
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const pushFrom = React.useCallback(
    (fromIndex: number, ref: PaneRef) => {
      navigate(pushPane(panes, fromIndex, ref));
    },
    [navigate, panes],
  );

  const closeAt = React.useCallback(
    (index: number) => {
      navigate(closePaneAt(panes, index));
    },
    [navigate, panes],
  );

  return { panes, pushFrom, closeAt };
}

export function StackedPaneLayout({
  renderPane,
  rootPane,
  renderRootPane,
  className,
}: StackedPaneLayoutProps) {
  const { panes, pushFrom, closeAt } = usePaneStack();
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  // Auto-scroll the rightmost pane into view when the stack grows.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
  }, [panes.length]);

  // Including the optional root pane in offset math.
  const rootOffset = rootPane ? 1 : 0;
  const totalPanes = panes.length + rootOffset;

  return (
    <div
      ref={scrollRef}
      data-slot="stacked-pane-layout"
      className={cn(
        'flex h-full w-full snap-x snap-mandatory overflow-x-auto bg-slate-50',
        // Fast linear horizontal slide — no bouncy easing, no fade.
        'scroll-smooth',
        className,
      )}
    >
      {rootPane && renderRootPane ? (
        <PaneSlot
          index={0}
          totalPanes={totalPanes}
          stickyLeftPx={0 * PANE_STACK_OFFSET_PX}
        >
          {renderRootPane({
            index: 0,
            isActive: panes.length === 0,
            totalPanes,
            pushPane: (next) => pushFrom(rootOffset - 1, next),
            closeThisPane: () => closeAt(0),
          })}
        </PaneSlot>
      ) : null}
      {panes.map((ref, i) => {
        const absoluteIndex = i + rootOffset;
        return (
          <PaneSlot
            key={`${ref.kind}-${ref.id}-${absoluteIndex}`}
            index={absoluteIndex}
            totalPanes={totalPanes}
            stickyLeftPx={absoluteIndex * PANE_STACK_OFFSET_PX}
          >
            {renderPane(ref, {
              index: absoluteIndex,
              isActive: i === panes.length - 1,
              totalPanes,
              pushPane: (next) => pushFrom(i, next),
              closeThisPane: () => closeAt(i),
            })}
          </PaneSlot>
        );
      })}
    </div>
  );
}

interface PaneSlotProps {
  index: number;
  totalPanes: number;
  stickyLeftPx: number;
  children: React.ReactNode;
}

function PaneSlot({ index, totalPanes, stickyLeftPx, children }: PaneSlotProps) {
  // Sticky left position keeps the stacked-card metaphor: panes pile
  // up at the left edge as the user scrolls right. No shadows by
  // design — strict ink-900 borders only.
  return (
    <section
      data-slot="stacked-pane"
      data-pane-index={index}
      data-pane-total={totalPanes}
      className={cn(
        'sticky shrink-0 snap-start border-r border-slate-900 bg-white',
        // Each pane has a fixed width so panes feel like index cards.
      )}
      style={{
        left: `${stickyLeftPx}px`,
        width: `${PANE_WIDTH_REM}rem`,
      }}
    >
      {children}
    </section>
  );
}

/**
 * Convenience hook for child components living inside a pane that
 * need to open another pane (e.g. a backlink button). Exposes the
 * same push/close primitives as the render context, but readable
 * from any depth.
 */
export function useStackedPanes() {
  const { panes, pushFrom, closeAt } = usePaneStack();
  return {
    panes,
    /** Push a new pane onto the end of the current stack. */
    open: (ref: PaneRef) => pushFrom(panes.length - 1, ref),
    /** Push a child of the pane at `fromIndex` (legacy callers). */
    pushFrom,
    closeAt,
  };
}
