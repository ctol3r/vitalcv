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

/* ── Rail leaf transforms (deep-audit W2.2) ─────────────────────────────────
   The rotary-file geometry, expressed as pure curves over the SAME offset
   domain as the opacity fan above, for the horizontal rail's JourneyCard
   leaves. These are the StickyProductStory motion-value stops, extracted so
   the rail (which drives transforms from ONE progress value in a rAF, not
   from Framer) renders the identical physical language. */

export const RAIL_LEAF_ROTATE_X_OFFSETS: number[] = [-2.4, -2, -1, 0, 1, 2, 2.4];
export const RAIL_LEAF_ROTATE_X_VALUES: number[] = [90, 76, 48, 0, -48, -76, -90];
export const RAIL_LEAF_Y_OFFSETS: number[] = [-2.4, -1, 0, 1, 2.4];
export const RAIL_LEAF_Y_VALUES: number[] = [-86, -34, 0, 36, 90];
export const RAIL_LEAF_Z_OFFSETS: number[] = [-2.4, -1, 0, 1, 2.4];
export const RAIL_LEAF_Z_VALUES: number[] = [-172, -48, 46, -6, -104];
export const RAIL_LEAF_SCALE_OFFSETS: number[] = [-2.4, -1, 0, 1, 2.4];
export const RAIL_LEAF_SCALE_VALUES: number[] = [0.8, 0.92, 1, 0.93, 0.83];

export interface RailLeafTransform {
  /** deg — positive tilts the leaf away above the spindle (completed). */
  rotateX: number;
  /** px vertical drift. */
  y: number;
  /** px depth (translateZ). */
  z: number;
  scale: number;
  opacity: number;
  zIndex: number;
}

/** The full rotary-file pose for a leaf at `offset = index − progress·span`. */
export function railLeafTransform(offset: number): RailLeafTransform {
  return {
    rotateX: lerpStops(offset, RAIL_LEAF_ROTATE_X_OFFSETS, RAIL_LEAF_ROTATE_X_VALUES),
    y: lerpStops(offset, RAIL_LEAF_Y_OFFSETS, RAIL_LEAF_Y_VALUES),
    z: lerpStops(offset, RAIL_LEAF_Z_OFFSETS, RAIL_LEAF_Z_VALUES),
    scale: lerpStops(offset, RAIL_LEAF_SCALE_OFFSETS, RAIL_LEAF_SCALE_VALUES),
    opacity: rolodexLeafOpacity(offset),
    zIndex: Math.round(60 - Math.abs(offset) * 8),
  };
}
