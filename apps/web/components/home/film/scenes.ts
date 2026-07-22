/**
 * The spike's scenes (COMPETE-2).
 *
 * The mandate's dispatch asks for "a single horizontal scene transition", so
 * the spike carries the first TWO of the six scenes — Arrival → Recognition —
 * which is the minimum that proves the transition mechanism. The remaining
 * four (Momentum, Opportunity, Start, Choice) are COMPETE-1.
 *
 * Copy ceiling, from the mandate: ONE short editorial phrase per scene, with
 * the NPI sentence only where it explains the action. Scene *names* are
 * internal — they are never rendered as section headers (retired mechanism
 * R6). They appear in the DOM only as `data-film-scene` hooks and as the
 * accessible name of each scene region, which screen readers need in order to
 * navigate a pinned composition.
 */

export interface FilmScene {
  /** Internal id. Never rendered as visible text. */
  readonly id: 'arrival' | 'recognition';
  /** Accessible region name. Not a visible header. */
  readonly label: string;
  /** THE one editorial phrase. */
  readonly phrase: string;
  /** Optional supporting sentence — permitted only where it explains the action. */
  readonly support?: string;
  /** Where this scene sits on the 0–1 film timeline. */
  readonly at: number;
}

export const FILM_SCENES: readonly FilmScene[] = Object.freeze([
  Object.freeze<FilmScene>({
    id: 'arrival',
    label: 'Start with your NPI',
    phrase: 'Get hired faster.',
    // The mandate permits the NPI sentence here because it explains the only
    // primary action on the surface.
    support: 'Start with your NPI.',
    at: 0,
  }),
  Object.freeze<FilmScene>({
    id: 'recognition',
    label: 'What is already true',
    // No product nouns, no taxonomy, no claim about a specific clinician.
    phrase: 'Your record is already out there.',
    at: 1,
  }),
]);

/**
 * Which scene owns the frame at a given progress, and how far into its own
 * transition it is.
 *
 * Returned `local` is what kinetic type reads: 0 = this scene is arriving,
 * 1 = it is fully seated. Consumers must not recompute this from raw progress,
 * so the scene boundaries live in exactly one place.
 */
export function sceneAt(progress: number): { index: number; local: number } {
  const clamped = Math.min(1, Math.max(0, progress));
  const spans = FILM_SCENES.length - 1;
  if (spans <= 0) return { index: 0, local: 1 };
  const scaled = clamped * spans;
  const index = Math.min(spans, Math.floor(scaled));
  return { index, local: scaled - index };
}
