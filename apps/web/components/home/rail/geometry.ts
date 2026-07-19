/**
 * Horizontal story-rail geometry (SHD-3.1) — pure functions mapping a bounded
 * VERTICAL scroll runway to HORIZONTAL chapter translation.
 *
 * The rail is the source template's native-scroll driver (SHD-0.2 manifest
 * rows 8/10/11 — keep the native driver, no scroll-jacking library): a tall
 * runway provides real scroll distance; a sticky viewport pins one 100vw
 * chapter at a time; the inner track translates by these functions. Because
 * translation is a pure function of scrollY, forward and reverse scrubbing are
 * symmetric and there is no wheel/keyboard trapping — the browser still owns
 * the scroll.
 *
 * All geometry is unit-tested; the React component only wires DOM + rAF to it.
 */

export interface RailGeometry {
  /** 0→1 progress through the pinned runway. */
  progress: number;
  /** Nearest chapter index (for the dot rail / active state). */
  activeIndex: number;
  /** Continuous track offset as a percentage of one viewport width (≥ 0). */
  translatePercent: number;
}

/**
 * Runway height (px) for `chapterCount` chapters, each dwelling `dwellVh`
 * viewport-heights. The extra `+ viewportH` is the sticky viewport itself:
 * the pin lasts exactly while the runway is under the top edge.
 */
export function railRunwayHeight(
  chapterCount: number,
  viewportH: number,
  dwellVh = 1,
): number {
  const chapters = Math.max(1, chapterCount);
  // (chapters − 1) transitions of travel + one viewport of pin.
  return Math.round((chapters - 1) * dwellVh * viewportH + viewportH);
}

/** Clamp helper. */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Resolve rail geometry for the current scroll position.
 *
 * @param scrollY      window scrollY (document space)
 * @param runwayTop    document-space top of the runway element
 * @param runwayHeight total runway height (from railRunwayHeight)
 * @param viewportH    current viewport height
 * @param chapterCount number of chapters
 */
export function resolveRail(
  scrollY: number,
  runwayTop: number,
  runwayHeight: number,
  viewportH: number,
  chapterCount: number,
): RailGeometry {
  const chapters = Math.max(1, chapterCount);
  // Travel distance = runway minus the one viewport the sticky element occupies.
  const travel = Math.max(1, runwayHeight - viewportH);
  const progress = clamp01((scrollY - runwayTop) / travel);
  const span = chapters - 1;
  return {
    progress,
    activeIndex: span <= 0 ? 0 : Math.round(progress * span),
    translatePercent: progress * span * 100,
  };
}

/**
 * The scrollY that lands `index` at its resting (centered) position — used by
 * dot-rail clicks, deep links, and keyboard focus so every chapter has a
 * stable, linkable rest state.
 */
export function scrollForChapter(
  index: number,
  runwayTop: number,
  runwayHeight: number,
  viewportH: number,
  chapterCount: number,
): number {
  const span = Math.max(1, chapterCount - 1);
  const travel = Math.max(1, runwayHeight - viewportH);
  const clampedIndex = Math.min(Math.max(0, index), span);
  return Math.round(runwayTop + (clampedIndex / span) * travel);
}
