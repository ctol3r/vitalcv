/**
 * Scene registry (SHD-1.2.3) — every homepage chapter DECLARES its visual
 * state; the scene layer renders it. No chapter hand-writes its own animation
 * logic, and no scene parameter lives outside this file.
 *
 * The registry is data, not behavior: the ambient field, grain, scrim, and
 * (in SHD-1.3) the chapter-progress driver all read from here, so the page
 * reads as ONE continuous spatial environment whose emphasis shifts by
 * chapter, rather than a stack of unrelated effects.
 *
 * Palette discipline (SHD-1.2.2): clinical paper/ink base; provenance
 * emerald for source signals; evidence indigo for proof; bounded amber only
 * for needs-action; red is RESERVED for real fail-closed/revoked states and
 * therefore does not appear in any decorative scene.
 */

export type SceneAccent = 'emerald' | 'indigo' | 'amber' | 'neutral';

export interface ChapterScene {
  /** DOM section id — must match the rail target (#wallet, #evidence, …). */
  id: string;
  /** Which signal family this chapter's atmosphere leans toward. */
  accent: SceneAccent;
  /** Secondary tint blended at low amplitude. */
  support: SceneAccent;
  /** Ambient drift speed multiplier (1 = hero baseline). Keep ≤ 1.5. */
  flow: number;
  /**
   * Pointer-wake amplitude 0–1 (the ChromaFlow substitute). 0 disables the
   * wake for chapters whose content is dense enough that motion would
   * compete with reading.
   */
  wake: number;
  /**
   * Minimum scrim opacity (0–1) guaranteed between the scene and any text
   * that sits directly on it. AA legibility is a floor, not a vibe —
   * enforced by test against SCENE_SCRIM_FLOOR.
   */
  scrim: number;
  /** Grain overlay opacity for this chapter (0 disables). */
  grain: number;
}

/**
 * Text may never sit on an unscrimmed animated region (SHD-1.2.4). Every
 * chapter must declare at least this much stable surface behind copy.
 */
export const SCENE_SCRIM_FLOOR = 0.55;

/**
 * The six-chapter contract from the master tasklist (§ Page composition).
 * Ids `wallet/evidence/matcha/apply/employers` are today's live section ids
 * (see HomepageSectionRail); `start` arrives with the SHD-3 rail and is
 * declared now so the registry — not the rail code — owns the journey shape.
 */
export const CHAPTER_SCENES: readonly ChapterScene[] = Object.freeze([
  Object.freeze<ChapterScene>({
    id: 'wallet',
    accent: 'emerald',
    support: 'indigo',
    flow: 1,
    wake: 0.35,
    scrim: 0.72,
    grain: 0.05,
  }),
  Object.freeze<ChapterScene>({
    id: 'evidence',
    accent: 'emerald',
    support: 'neutral',
    flow: 0.7,
    wake: 0.2,
    scrim: 0.78,
    grain: 0.04,
  }),
  Object.freeze<ChapterScene>({
    id: 'matcha',
    accent: 'indigo',
    support: 'emerald',
    flow: 1.15,
    wake: 0.3,
    scrim: 0.72,
    grain: 0.05,
  }),
  Object.freeze<ChapterScene>({
    id: 'apply',
    accent: 'indigo',
    support: 'neutral',
    flow: 0.8,
    wake: 0.15,
    scrim: 0.8,
    grain: 0.04,
  }),
  Object.freeze<ChapterScene>({
    id: 'employers',
    accent: 'amber',
    support: 'indigo',
    flow: 0.9,
    wake: 0.25,
    scrim: 0.75,
    grain: 0.05,
  }),
  Object.freeze<ChapterScene>({
    id: 'start',
    accent: 'emerald',
    support: 'indigo',
    flow: 1.2,
    wake: 0.35,
    scrim: 0.72,
    grain: 0.05,
  }),
]);

export function getChapterScene(id: string): ChapterScene {
  return CHAPTER_SCENES.find((c) => c.id === id) ?? CHAPTER_SCENES[0];
}
