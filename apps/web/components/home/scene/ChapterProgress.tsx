'use client';

/**
 * ChapterProgressProvider (SHD-1.3) — the ONE scroll listener behind every
 * scroll-coupled homepage visual.
 *
 * One passive, rAF-throttled scroll/resize subscription computes the
 * ChapterProgress model (progress.ts) and fans it out two ways:
 *
 *  - `subscribe(cb)` — per-frame consumers (the ambient field) read the full
 *    continuous model through a callback, outside React render;
 *  - `useActiveChapter()` — low-frequency consumers (the dot rail) re-render
 *    only when the ACTIVE CHAPTER ID changes, never per scroll frame.
 *
 * The anchor sits at 35% of the viewport height — matching the observer
 * semantics the rail used before (a section is "current" once its top passes
 * the upper third). Chapter spans are re-measured on resize and on section
 * layout shifts (ResizeObserver on document.body), so late-hydrating content
 * cannot leave stale offsets behind.
 */

import * as React from 'react';

import {
  resolveProgress,
  type ChapterProgress,
  type ChapterSpan,
} from './progress';

/** DOM ids the driver discovers, in journey order (missing ids are skipped). */
export const CHAPTER_DOM_IDS = [
  'wallet',
  'readiness',
  'matcha',
  'apply',
  'employers',
  'start',
] as const;

const ANCHOR_VIEWPORT_FRACTION = 0.35;

type ProgressListener = (p: ChapterProgress) => void;

interface ChapterProgressContextValue {
  activeId: string;
  subscribe: (cb: ProgressListener) => () => void;
  getProgress: () => ChapterProgress | null;
}

const ChapterProgressContext = React.createContext<ChapterProgressContextValue | null>(null);

export function ChapterProgressProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = React.useState<string>(CHAPTER_DOM_IDS[0]);
  const listenersRef = React.useRef<Set<ProgressListener>>(new Set());
  const progressRef = React.useRef<ChapterProgress | null>(null);
  const activeIdRef = React.useRef(activeId);

  React.useEffect(() => {
    let spans: ChapterSpan[] = [];
    let raf = 0;

    const measure = () => {
      spans = CHAPTER_DOM_IDS.map((id): ChapterSpan | null => {
        const el = document.getElementById(id);
        if (!el) return null;
        return { id, top: el.getBoundingClientRect().top + window.scrollY };
      })
        .filter((s): s is ChapterSpan => s !== null)
        .sort((a, b) => a.top - b.top);
    };

    const compute = () => {
      raf = 0;
      if (spans.length === 0) return;
      const anchor = window.scrollY + window.innerHeight * ANCHOR_VIEWPORT_FRACTION;
      const p = resolveProgress(anchor, spans, document.documentElement.scrollHeight);
      if (!p) return;
      progressRef.current = p;
      listenersRef.current.forEach((cb) => cb(p));
      if (p.id !== activeIdRef.current) {
        activeIdRef.current = p.id;
        setActiveId(p.id);
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    const remeasure = () => {
      measure();
      schedule();
    };

    remeasure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', remeasure);
    // Late-hydrating sections (carousels, story panels) move chapter tops.
    const ro = new ResizeObserver(remeasure);
    ro.observe(document.body);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', remeasure);
      ro.disconnect();
    };
  }, []);

  const value = React.useMemo<ChapterProgressContextValue>(
    () => ({
      activeId,
      subscribe: (cb) => {
        listenersRef.current.add(cb);
        const current = progressRef.current;
        if (current) cb(current);
        return () => listenersRef.current.delete(cb);
      },
      getProgress: () => progressRef.current,
    }),
    [activeId],
  );

  return (
    <ChapterProgressContext.Provider value={value}>{children}</ChapterProgressContext.Provider>
  );
}

/** Active chapter id; re-renders only on chapter change. `null` = no provider. */
export function useActiveChapter(): string | null {
  return React.useContext(ChapterProgressContext)?.activeId ?? null;
}

/**
 * Per-frame progress subscription for canvas consumers. No-op without a
 * provider (consumer falls back to its static configuration).
 */
export function useChapterProgressSubscription(cb: ProgressListener | null): void {
  const ctx = React.useContext(ChapterProgressContext);
  React.useEffect(() => {
    if (!ctx || !cb) return;
    return ctx.subscribe(cb);
  }, [ctx, cb]);
}
