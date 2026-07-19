/**
 * Rotary-file fan curves (SHD-3.2).
 *
 * The homepage story is a rolodex: cards flip around a spindle below the stack.
 * The masterlist's exit criterion is that, at rest, at least TWO leaves each
 * side of the active card stay visibly fanned (the earlier curve faded them to
 * a whisper, hiding the card-file mechanic). These curves are pure data, mapped
 * by Framer `useTransform` over `offset = index - progress`, and exported so the
 * "≥2 visible leaves each side" contract is unit-lockable WITHOUT the
 * scroll-driven runtime (the homepage uses a custom clipped-scroll model that
 * can't be driven headlessly).
 */

/** Opacity fan keyed by offset. ±1 and ±2 stay readable; cull only beyond. */
export const ROLODEX_OPACITY_OFFSETS: number[] = [-2.7, -2, -1, 0, 1, 2, 2.7];
export const ROLODEX_OPACITY_VALUES: number[] = [0, 0.5, 0.9, 1, 0.9, 0.5, 0];

/** A leaf is considered visible (part of the fan) at/above this opacity. */
export const LEAF_VISIBLE_THRESHOLD = 0.15;

/** Piecewise-linear interpolation matching Framer `useTransform` semantics
 *  (clamped at the ends). */
export function lerpStops(x: number, xs: readonly number[], ys: readonly number[]): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 1; i < xs.length; i += 1) {
    if (x <= xs[i]) {
      const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return ys[i - 1] + t * (ys[i] - ys[i - 1]);
    }
  }
  return ys[ys.length - 1];
}

/** Opacity of a leaf at a given offset from the active card. */
export function rolodexLeafOpacity(offset: number): number {
  return lerpStops(offset, ROLODEX_OPACITY_OFFSETS, ROLODEX_OPACITY_VALUES);
}

/** Whether a leaf at `offset` is part of the visible fan. */
export function rolodexLeafVisible(offset: number): boolean {
  return rolodexLeafOpacity(offset) > LEAF_VISIBLE_THRESHOLD;
}
