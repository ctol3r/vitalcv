'use client';

import * as React from 'react';

/**
 * THE film driver (COMPETE-2 spike → COMPETE-1 production).
 *
 * This is the ONE page-level scroll owner described in
 * docs/design/homepage-composition-ownership.md §2. Its contract:
 *
 *   1. Exactly ONE passive scroll listener.
 *   2. Exactly ONE requestAnimationFrame loop.
 *   3. Consumers READ progress. They never attach their own listener.
 *   4. The vertical axis is never hijacked — no wheel handler, no
 *      preventDefault, no nested scroller, no axis remapping. Ordinary
 *      vertical scroll is TRANSLATED into horizontal travel; it is never
 *      captured. A user who scrolls past the film keeps scrolling normally.
 *
 * Rule 4 is why this is a `sticky` stage inside a tall spacer rather than a
 * scroll-jacking container: the browser keeps full ownership of scrolling, and
 * we only read `getBoundingClientRect()`.
 *
 * Eligibility is deliberately conservative. Anything that is not a
 * comfortable desktop pointer environment gets `pinned: false`, which the
 * consumer renders as the ordinary vertical document (fallback tiers 4–6).
 */

export interface FilmProgress {
  /** 0 → 1 across the film. Always 0 before hydration and when ineligible. */
  progress: number;
  /**
   * Whether this device/viewport may render the film at all.
   *
   * This — NOT `pinned` — is what drives the layout mode, and the distinction
   * is load-bearing. The film's scroll runway only exists once film layout is
   * applied, so gating layout on `pinned` is circular: the stage can never be
   * stuck because the runway is never tall enough to stick to. Eligibility is
   * a pure device question and has no such dependency.
   */
  eligible: boolean;
  /** Whether the stage is currently stuck. Describes state; never gates layout. */
  pinned: boolean;
  /** True once capability detection has run (post-hydration). */
  ready: boolean;
}

const INITIAL: FilmProgress = { progress: 0, eligible: false, pinned: false, ready: false };

/** Below this width the film is not attempted — vertical is the design there. */
export const FILM_MIN_WIDTH = 1024;
/** Below this height a pinned stage would crop the composition. */
export const FILM_MIN_HEIGHT = 560;

export function filmEligible(win: Window): boolean {
  const media = (q: string) => {
    try {
      return win.matchMedia(q).matches;
    } catch {
      return false;
    }
  };
  if (media('(prefers-reduced-motion: reduce)')) return false;
  // A coarse pointer means touch. Pinned horizontal travel on touch fights the
  // user's own scroll momentum, so touch always gets the vertical composition.
  if (media('(pointer: coarse)')) return false;
  return win.innerWidth >= FILM_MIN_WIDTH && win.innerHeight >= FILM_MIN_HEIGHT;
}

/**
 * Map a spacer's viewport position to 0–1.
 *
 * The spacer is `runwayVh` tall. While its top is above the viewport top and
 * its bottom is still below, the stage is stuck and progress tracks how far
 * through the runway we are.
 */
export function progressFromRect(top: number, height: number, viewportHeight: number): number {
  const travel = height - viewportHeight;
  if (travel <= 0) return 0;
  return Math.min(1, Math.max(0, -top / travel));
}

/**
 * @param ref     the tall spacer element that gives the film its scroll runway
 * @param enabled set false to hard-disable (used by the harness tier switcher)
 */
export function useFilmProgress(
  ref: React.RefObject<HTMLElement | null>,
  enabled = true,
): FilmProgress {
  const [state, setState] = React.useState<FilmProgress>(INITIAL);

  // Progress lives in a ref between frames so the scroll listener itself never
  // triggers a React render — only the rAF tick commits, and only on change.
  const frame = React.useRef<number | null>(null);
  const latest = React.useRef<FilmProgress>(INITIAL);

  React.useEffect(() => {
    if (!enabled) {
      setState({ progress: 0, eligible: false, pinned: false, ready: true });
      return;
    }

    let cancelled = false;

    const commit = (next: FilmProgress) => {
      const prev = latest.current;
      // Quantise to 1/1000 — sub-pixel progress churn would re-render the tree
      // every frame for no visible difference.
      const changed =
        Math.abs(next.progress - prev.progress) > 0.001 ||
        next.eligible !== prev.eligible ||
        next.pinned !== prev.pinned ||
        next.ready !== prev.ready;
      if (!changed) return;
      latest.current = next;
      if (!cancelled) setState(next);
    };

    const measure = () => {
      frame.current = null;
      const el = ref.current;
      if (!el) return;

      if (!filmEligible(window)) {
        commit({ progress: 0, eligible: false, pinned: false, ready: true });
        return;
      }

      const rect = el.getBoundingClientRect();
      const progress = progressFromRect(rect.top, rect.height, window.innerHeight);
      // "Pinned" means the stage is genuinely stuck: the spacer straddles the
      // viewport. Outside that window the film holds its end state rather than
      // snapping, so scrolling past it stays visually continuous.
      const pinned = rect.top <= 0 && rect.bottom >= window.innerHeight;
      commit({ progress, eligible: true, pinned, ready: true });
    };

    const schedule = () => {
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(measure);
    };

    measure();
    // THE one listener. Passive: we only read geometry, never preventDefault.
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionQuery.addEventListener('change', schedule);

    return () => {
      cancelled = true;
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      motionQuery.removeEventListener('change', schedule);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [ref, enabled]);

  return state;
}
