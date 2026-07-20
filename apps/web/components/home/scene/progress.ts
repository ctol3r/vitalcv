/**
 * Chapter progress model (SHD-1.3.3) — ONE continuous `0 → 1`-per-chapter
 * driver for every scroll-coupled visual system on the homepage.
 *
 * The page's journey position is a single number `global = index + local`
 * computed from the scroll anchor against the chapter section tops. The dot
 * rail, the ambient scene handoff, and (in SHD-3) the horizontal rail all
 * read THIS value — no component owns a private scroll listener, so forward
 * and reverse scrubbing are symmetric by construction (the model is a pure
 * function of scroll position; there is no state to jump, reset, or
 * mismatch).
 *
 * Scene handoff: during the final BLEND_WINDOW fraction of a chapter, its
 * scene crossfades into the next (smoothstepped). Entering the next chapter
 * lands at exactly the faded-to scene, so the journey reads as one
 * continuous environment in both directions.
 */

import { getChapterScene, type ChapterScene } from './registry';

export interface ChapterSpan {
  /** DOM section id (may be an alias — registry resolves the scene). */
  id: string;
  /** Document-space top (px). */
  top: number;
}

export interface SceneBlend {
  from: ChapterScene;
  to: ChapterScene;
  /** 0 = pure `from`, 1 = pure `to`; smoothstepped. */
  t: number;
}

export interface ChapterProgress {
  /** Active chapter index (the span containing the anchor). */
  index: number;
  /** Active chapter DOM id. */
  id: string;
  /** 0→1 position within the active span. */
  local: number;
  /** Continuous journey position: index + local. */
  global: number;
  blend: SceneBlend;
}

/** Fraction of a span over which the outgoing scene crossfades to the next. */
export const BLEND_WINDOW = 0.3;

export function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/**
 * Resolve the journey position for a document-space anchor.
 * `endY` bounds the final span (typically the document height); spans must
 * be sorted by top. Returns null when no chapter sections exist.
 */
export function resolveProgress(
  anchorY: number,
  spans: readonly ChapterSpan[],
  endY: number,
): ChapterProgress | null {
  if (spans.length === 0) return null;

  let index = 0;
  for (let i = 0; i < spans.length; i++) {
    if (anchorY >= spans[i].top) index = i;
  }
  const top = spans[index].top;
  const bottom = index + 1 < spans.length ? spans[index + 1].top : Math.max(endY, top + 1);
  const local = Math.min(1, Math.max(0, (anchorY - top) / Math.max(1, bottom - top)));

  const here = getChapterScene(spans[index].id);
  const next = index + 1 < spans.length ? getChapterScene(spans[index + 1].id) : here;
  const raw = local >= 1 - BLEND_WINDOW ? (local - (1 - BLEND_WINDOW)) / BLEND_WINDOW : 0;

  return {
    index,
    id: spans[index].id,
    local,
    global: index + local,
    blend: { from: here, to: next, t: smoothstep(raw) },
  };
}

/**
 * Build a ChapterProgress from the horizontal rail's continuous position
 * (W2 bridge). While the rail is pinned, its chapters share one document top
 * (the track translates instead of scrolling), so the vertical-span model
 * cannot see the journey — the rail publishes THIS instead, and the ambient
 * scene follows the same single driver in both modes.
 */
export function railChapterProgress(
  chapterIds: readonly string[],
  progress01: number,
): ChapterProgress | null {
  if (chapterIds.length === 0) return null;
  const span = Math.max(1, chapterIds.length - 1);
  const global = Math.min(1, Math.max(0, progress01)) * span;
  const index = Math.min(chapterIds.length - 1, Math.floor(global));
  const local = Math.min(1, Math.max(0, global - index));
  const here = getChapterScene(chapterIds[index]);
  const next = index + 1 < chapterIds.length ? getChapterScene(chapterIds[index + 1]) : here;
  const raw = local >= 1 - BLEND_WINDOW ? (local - (1 - BLEND_WINDOW)) / BLEND_WINDOW : 0;
  return {
    index,
    id: chapterIds[index],
    local,
    global,
    blend: { from: here, to: next, t: smoothstep(raw) },
  };
}

export interface BlendedSceneParams {
  flow: number;
  wake: number;
  scrim: number;
  grain: number;
}

/**
 * Interpolate the numeric scene parameters for a handoff. Linear on purpose:
 * both endpoints honor SCENE_SCRIM_FLOOR, so every intermediate value does
 * too — the legibility floor survives the entire transition.
 */
export function blendSceneParams(blend: SceneBlend): BlendedSceneParams {
  const { from, to, t } = blend;
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    flow: lerp(from.flow, to.flow),
    wake: lerp(from.wake, to.wake),
    scrim: lerp(from.scrim, to.scrim),
    grain: lerp(from.grain, to.grain),
  };
}
