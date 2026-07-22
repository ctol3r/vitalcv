/**
 * The six film scenes (COMPETE-1).
 *
 * Copy ceiling, from the mandate: ONE short editorial phrase per scene, with
 * the NPI sentence only where it explains the action. Scene *names* are
 * internal — they are never rendered as section headers (retired mechanism
 * R6). They appear in the DOM only as `data-film-scene` hooks and as each
 * scene region's accessible name, which a screen reader needs in order to
 * navigate a pinned composition.
 *
 * `artifact` names the REAL product surface each scene carries. That mapping
 * is the point of COMPETE-1: the film recomposes existing capability, it does
 * not decorate over it. A scene with `artifact: null` is pure choreography and
 * must never imply a product claim.
 */

export type FilmArtifact =
  | 'npi'        // the NPI control + real returned state
  | 'proof'      // the proof-packet inspector + the truth boundary
  | 'routes'     // clinician primary / employer secondary
  | null;

export interface FilmScene {
  /** Internal id. Never rendered as visible text. */
  readonly id: 'arrival' | 'recognition' | 'momentum' | 'opportunity' | 'start' | 'choice';
  /** Accessible region name. Not a visible header. */
  readonly label: string;
  /** THE one editorial phrase. */
  readonly phrase: string;
  /** Optional supporting sentence — only where it explains the action. */
  readonly support?: string;
  /** The real product surface this scene carries, if any. */
  readonly artifact: FilmArtifact;
}

export const FILM_SCENES: readonly FilmScene[] = Object.freeze([
  Object.freeze<FilmScene>({
    id: 'arrival',
    label: 'Start with your NPI',
    phrase: 'Get hired faster.',
    // Permitted here because it explains the only primary action.
    support: 'Start with your NPI.',
    artifact: 'npi',
  }),
  Object.freeze<FilmScene>({
    id: 'recognition',
    // No product nouns, no taxonomy, no claim about a specific clinician.
    label: 'What is already true',
    phrase: 'Your record is already out there.',
    artifact: 'npi',
  }),
  Object.freeze<FilmScene>({
    id: 'momentum',
    label: 'Proof you keep',
    phrase: 'Stop starting over.',
    // The cited industry benchmark, as ink — this is what survives of
    // TimeToStartComparison (composition-ownership C5 ruling). It is an
    // INDUSTRY figure, never a VitalCV result, and it is worded to say so.
    support: 'The industry queue runs about 90–120 days.',
    artifact: null,
  }),
  Object.freeze<FilmScene>({
    id: 'opportunity',
    label: 'Roles measured against your evidence',
    phrase: 'See what actually fits.',
    artifact: null,
  }),
  Object.freeze<FilmScene>({
    id: 'start',
    label: 'What an employer receives',
    phrase: 'Hand over proof, not promises.',
    artifact: 'proof',
  }),
  Object.freeze<FilmScene>({
    id: 'choice',
    label: 'Where to go next',
    phrase: 'Your evidence. Your permission.',
    artifact: 'routes',
  }),
]);

/**
 * Which scene owns the frame at a given progress, and how far into its own
 * transition it is.
 *
 * `local` is what kinetic type reads: 0 = this scene is arriving, 1 = it is
 * fully seated. Consumers must not recompute this from raw progress, so the
 * scene boundaries live in exactly one place.
 */
export function sceneAt(progress: number): { index: number; local: number } {
  const clamped = Math.min(1, Math.max(0, progress));
  const spans = FILM_SCENES.length - 1;
  if (spans <= 0) return { index: 0, local: 1 };
  const scaled = clamped * spans;
  const index = Math.min(spans, Math.floor(scaled));
  return { index, local: scaled - index };
}
