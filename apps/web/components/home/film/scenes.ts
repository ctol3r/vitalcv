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
 *
 * ---------------------------------------------------------------------------
 * 2026-07-26 — restructured to six DISTINCT claims.
 *
 * Founder review: "it's selling one thing and the same thing over and over."
 * Correct. The previous set read `Get hired faster` → `Your record is already
 * out there` → `Stop starting over` → `Hand over proof, not promises`: one idea
 * in four costumes, with no opportunity story and no employer story at all.
 *
 * The reference is Carefam's hire page, which earns its length by giving each
 * value proposition its own frame and its own visual — cost, speed, quality,
 * automation. This set does the same with the three the founder named — better
 * opportunities, better hiring, speed — plus the one thing neither competitor
 * can answer, which is why anyone should believe the evidence at all.
 *
 * TWO CLAIMS ARE DELIBERATELY NOT MADE HERE.
 *
 * 1. No speed multiple. Carefam publishes "Hire 3x faster" behind 300+
 *    facilities and named testimonials. VitalCV has run no measured pilot —
 *    /pilot's only figure is explicitly labelled an internal simulation — so a
 *    multiple here would be the first claim a buyer tests and the first one to
 *    fail. `verification` therefore carries the INDUSTRY baseline, worded as
 *    industry, and lets the artifact make the argument. The moment a pilot
 *    measures a real number it replaces this line, and a measured number beats
 *    a claimed one.
 *
 * 2. No blockchain, chain, ledger, wallet, or DID vocabulary. The competitive
 *    mandate bans it from the acquisition path, and `TRUST_ANCHORS` is a
 *    feature flag currently set to false — anchoring is not running. What IS
 *    running is stronger for this purpose, and is what `verification` says in
 *    plain words: receipts are ES256-signed and the public key is published at
 *    /.well-known/jwks.json, so a verifier can check one WITHOUT trusting
 *    VitalCV. In an era where a convincing credential PDF takes seconds to
 *    generate, that is the differentiator.
 */

export type FilmArtifact =
  | 'npi' // the NPI control + the empty record
  | 'state' // real returned state, only after a lookup
  | 'fit' // how a role is measured against a record
  | 'packet' // what an employer actually receives
  | 'signature' // the signed receipt + the published key
  | 'routes' // clinician primary / employer secondary
  | null;

export interface FilmScene {
  /** Internal id. Never rendered as visible text. */
  readonly id:
    | 'arrival'
    | 'opportunities'
    | 'hiring'
    | 'verification'
    | 'choice';
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
    // 'npi' AND 'state': the field and its answer are one scene now. The answer
    // used to live in a scene of its own ('recognition'), which meant the
    // reader was carried to a different frame to be told a result — and, for
    // every visitor who had not typed an NPI, that frame was a sentence of
    // apology on blank paper. It was the emptiest thing on the site.
    //
    // An answer belongs where the question was asked. `LiveNpiResult` now
    // replaces the empty record in place, so the record a visitor is looking at
    // becomes their record. Nothing is fabricated before a lookup: until one
    // returns, this scene shows the six sources stamped "Not checked", which is
    // the literal truth for someone who has entered nothing.
    artifact: 'npi',
  }),
  Object.freeze<FilmScene>({
    id: 'opportunities',
    label: 'Roles measured against your record',
    phrase: 'Better opportunities.',
    support: 'Roles measured against the record you have.',
    artifact: 'fit',
  }),
  Object.freeze<FilmScene>({
    id: 'hiring',
    label: 'What an employer receives',
    phrase: 'Better hiring.',
    support: 'Employers begin from evidence, not from scratch.',
    artifact: 'packet',
  }),
  Object.freeze<FilmScene>({
    id: 'verification',
    label: 'Checkable without trusting us',
    // Reframed from "Check it without asking us." — true, but it sold the
    // MECHANISM (verification) rather than the THING THE MECHANISM BUYS
    // (throughput). VitalCV is not a credentialing platform and must not read
    // as one: the reason a checkable receipt matters is that nobody has to run
    // the check again, which is where a 90–120 day queue actually goes. Lead
    // with what the clinician gets; let the artifact below show how.
    phrase: 'Prove it once.',
    // The industry figure, as ink. It is an INDUSTRY benchmark, never a VitalCV
    // result, and it is worded so it cannot be read as one. Trimmed to the
    // 8-word support ceiling; "industry" carries the attribution, and the
    // re-checking argument is the scene's job to show, not the caption's.
    support: 'The industry queue runs about 90–120 days.',
    artifact: 'signature',
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
