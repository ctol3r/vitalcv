'use client';

import * as React from 'react';

/**
 * THE film driver — the ONE page-level scroll owner
 * (docs/design/homepage-composition-ownership.md §2). Its contract:
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
 * ---------------------------------------------------------------------------
 * 2026-08-02 — continuous progress leaves React.
 *
 * Progress used to be React state, quantised to 1/1000 to stop sub-pixel churn
 * from re-rendering the tree. That still meant up to a thousand renders of the
 * whole homepage across one scroll, to move one transform. The rAF now writes
 * `--film-progress` straight onto the root element and React is told only when
 * something DISCRETE changes: eligibility, readiness, pinned-ness, and which
 * chapter owns the frame. That is a handful of renders for an entire journey,
 * and the transform itself is composited from CSS.
 *
 * The scroll listener and the rAF loop are still one each, in this one module,
 * which is what `experience-doctrine.test.ts` enforces across everything
 * reachable from `app/page.tsx`.
 */

export interface FilmProgress {
  /**
   * Which chapter owns the frame, 0-based. This is the only continuous value
   * promoted to React, and it changes at most `chapters - 1` times per journey.
   */
  index: number;
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

const INITIAL: FilmProgress = { index: 0, eligible: false, pinned: false, ready: false };

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
 * Which chapter owns the frame at a given progress.
 *
 * Rounded rather than floored: the chapter a reader is LOOKING at is the one
 * nearest the frame, so the rail's active label changes at the midpoint of a
 * transition instead of the instant the previous chapter starts to leave.
 */
export function chapterAt(progress: number, chapters: number): number {
  const spans = Math.max(1, chapters - 1);
  return Math.min(spans, Math.round(Math.min(1, Math.max(0, progress)) * spans));
}

/**
 * @param runwayRef the tall spacer element that gives the film its scroll runway
 * @param rootRef   the element that carries `--film-progress` for the CSS transform
 * @param chapters  how many chapters the track holds
 * @param enabled   set false to hard-disable (used when a real result is showing)
 */
export function useFilmProgress(
  runwayRef: React.RefObject<HTMLElement | null>,
  rootRef: React.RefObject<HTMLElement | null>,
  chapters: number,
  enabled = true,
  /**
   * A chapter's own scroll spacer. Its 0-1 progress is published as
   * `--stage-progress`, which is what drives horizontal movement INSIDE a
   * sticky stage.
   *
   * It is measured here, in the same rAF as everything else, rather than by a
   * second hook: the page gets exactly one scroll listener and one rAF, and
   * `experience-doctrine.test.ts` enforces that across every module reachable
   * from `app/page.tsx`. A per-stage hook would be the second owner CD-11
   * forbids, and would be the easy mistake to make here.
   */
  stageRef?: React.RefObject<HTMLElement | null>,
): FilmProgress {
  const [state, setState] = React.useState<FilmProgress>(INITIAL);
  const frame = React.useRef<number | null>(null);
  const latest = React.useRef<FilmProgress>(INITIAL);

  React.useEffect(() => {
    /*
      Page-wide travel is retired, so `enabled` is false — but the STAGE still
      needs driving, because horizontal movement inside a sticky chapter is
      exactly what replaced it. This branch therefore keeps the listener and
      the rAF and simply stops publishing page progress.
    */
    const pageEnabled = enabled;

    let cancelled = false;

    const commit = (next: FilmProgress) => {
      const prev = latest.current;
      const changed =
        next.index !== prev.index ||
        next.eligible !== prev.eligible ||
        next.pinned !== prev.pinned ||
        next.ready !== prev.ready;
      if (!changed) return;
      latest.current = next;
      if (!cancelled) setState(next);
    };

    const measure = () => {
      frame.current = null;
      const root = rootRef.current;

      /*
        The stage is measured FIRST and unconditionally.

        It is not gated on `filmEligible`, because a sticky stage is not the
        retired page-wide travel: it works on a phone, and it is the feature
        that replaced sideways page movement. What reduced motion does to it is
        a CSS decision (the track simply does not translate), not a reason to
        stop measuring — stopping here would leave `--stage-progress` frozen at
        whatever value it last held.
      */
      const stage = stageRef?.current;
      if (stage && root) {
        const s = stage.getBoundingClientRect();
        root.style.setProperty(
          '--stage-progress',
          progressFromRect(s.top, s.height, window.innerHeight).toFixed(4),
        );
      }

      const el = runwayRef.current;
      if (!el) return;

      if (!pageEnabled || !filmEligible(window)) {
        root?.style.setProperty('--film-progress', '0');
        commit({ index: 0, eligible: false, pinned: false, ready: true });
        return;
      }

      const rect = el.getBoundingClientRect();
      const progress = progressFromRect(rect.top, rect.height, window.innerHeight);

      // The continuous value goes straight to CSS. No render, no reconciliation
      // — the compositor moves the track and React never hears about it.
      root?.style.setProperty('--film-progress', progress.toFixed(4));

      // "Pinned" means the stage is genuinely stuck: the spacer straddles the
      // viewport. Outside that window the film holds its end state rather than
      // snapping, so scrolling past it stays visually continuous.
      const pinned = rect.top <= 0 && rect.bottom >= window.innerHeight;
      commit({ index: chapterAt(progress, chapters), eligible: true, pinned, ready: true });
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
  }, [runwayRef, rootRef, chapters, enabled, stageRef]);

  return state;
}
