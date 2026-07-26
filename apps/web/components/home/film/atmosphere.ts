/**
 * Evidence atmosphere — the pure model (COMPETE-2 spike).
 *
 * This file is the whole reason the spike can be tested without a browser: it
 * is deterministic, DOM-free geometry. The renderer (Canvas 2D, or the SSR
 * poster) only draws what these functions return.
 *
 * WHAT THIS IS NOT: a graph. There are no nodes, no edges, no links, no
 * people, no physics, and no force simulation — those are retired mechanism R1
 * (docs/strategy/competitive-mandate.md). The atmosphere is made of *record
 * fragments*: thin horizontal strips, the visual memory of a torn receipt or a
 * ruled line from a source record. Fragments never connect to each other. If a
 * future change draws a line BETWEEN two fragments, it has built a graph and
 * violates the mandate.
 *
 * The scene event this models (mandate, six scenes):
 *   Arrival     — "empty career core gathers source light": fragments are
 *                 scattered, dim, unaligned.
 *   Recognition — "NPI unlocks real evidence state": the same fragments settle
 *                 into legible, aligned strata and their source lane reads.
 *
 * Nothing here is clinician-specific. The spike renders abstract choreography
 * only; no personal state exists before a real lookup returns (COMPETE-3).
 */

/** Source lane families — the palette contract from scene/registry.ts. */
export type FragmentLane = 'provenance' | 'evidence' | 'attention' | 'neutral';

export interface Fragment {
  /** Stable identity, so a re-render never reshuffles the field. */
  readonly id: number;
  /** Scattered origin, normalized 0–1 in stage space. */
  readonly fromX: number;
  readonly fromY: number;
  /** Settled destination, normalized 0–1 in stage space. */
  readonly toX: number;
  readonly toY: number;
  /** Strip length, normalized to stage width. */
  readonly width: number;
  /** Per-fragment drift phase so the field never pulses in unison. */
  readonly phase: number;
  readonly lane: FragmentLane;
  /**
   * Whether this row carries a leading tick — a short mark at its start.
   *
   * This is the strongest single cue that separates "record row" from "grey
   * bar". A bare strip is the loading-skeleton idiom; a strip with a mark at
   * its head is a ledger entry. Only a MINORITY are marked, because a tick on
   * every row is just a heavier texture — a few marked entries among plain
   * rules is what a register actually looks like.
   *
   * Deliberately NOT colour. The lanes are ink-only (see LANE_INK): spending
   * the state palette on decoration devalues the one place green is allowed to
   * mean that a source returned something (CD-4).
   */
  readonly marked: boolean;
}

export interface FragmentPose {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly opacity: number;
  readonly lane: FragmentLane;
  /** See `Fragment.marked` — the renderer draws a leading tick when true. */
  readonly marked: boolean;
}

/**
 * Mulberry32 — a tiny deterministic PRNG.
 *
 * Seeded, NOT Math.random: the SSR poster, the Canvas 2D tier, and the vitest
 * assertions must all produce the identical field, or the static fallback would
 * visibly "jump" into a different composition on hydration.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Lane mix. Weighted toward provenance/evidence because those are the two
 * families that carry the product's meaning; `attention` is deliberately rare
 * (bounded amber = needs-action only), and red never appears in decoration.
 */
const LANES: readonly FragmentLane[] = Object.freeze([
  'provenance', 'provenance', 'provenance',
  'evidence', 'evidence', 'evidence',
  'neutral', 'neutral',
  'attention',
]);

/**
 * The measures a record row may take, as a fraction of stage width.
 *
 * DISCRETE, not continuous — and this is the single most important line in the
 * file for how the page reads.
 *
 * The field previously drew `0.05 + rand() * 0.22`: every strip a different
 * ragged length. That is precisely the loading-skeleton idiom, and the founder
 * read the live page exactly as it was drawn — as a page that had failed to
 * load rather than one that was finished. Ragged reads as broken; ruled reads
 * as intentional. Real record matter repeats its measures because real records
 * have columns.
 */
const RULED_MEASURES = Object.freeze([0.05, 0.09, 0.14, 0.21]);

/** The rhythm scattered rows snap to, so even the unsettled field looks ruled. */
const SCATTER_ROWS = 15;

/**
 * The copy keep-out — the most important constraint in this file.
 *
 * Fragments used to settle at `toX ≈ 0.08–0.14` across eleven bands spanning
 * `y 0.16–0.84`. That is the left column, and the left column is where the
 * headline and the body copy live: the atmosphere was DESIGNED to land on the
 * type. While the rows were ragged it merely looked noisy. Once they were
 * snapped to a baseline rhythm they stopped missing — and every scene rendered
 * its own sentences with rules drawn cleanly through them.
 *
 * A horizontal line through text is strikethrough. It is the one mark every
 * reader knows means deleted, void, retracted. On a page whose entire argument
 * is that its claims can be trusted, the claims looked crossed out. That is
 * also why "make the atmosphere quieter" never fixed it — the problem was
 * never density, it was position.
 *
 * So the field is confined to two margins, above and below the reading zone,
 * at every progress including mid-transition. Making this a property of the
 * MODEL rather than a rect the renderer has to measure means the SSR poster,
 * the Canvas 2D tier, and the tests all inherit it for free — and no future
 * change can reintroduce the collision by adjusting opacity or count.
 *
 * It is a better composition, too: evidence now frames the argument instead of
 * competing with it, and the quiet middle is deliberate rather than accidental.
 */
const BAND_TOP = Object.freeze({ min: 0.03, max: 0.2 });
const BAND_BOTTOM = Object.freeze({ min: 0.82, max: 0.97 });

/** Ruled rows per margin band. */
const ROWS_PER_BAND = 6;

/**
 * Lowered from 64. With every scene now carrying a real product artifact
 * (FilmRecord / FilmFit / ProofPacketInspector / FilmSignature), the atmosphere
 * no longer has to carry a frame on its own — so it can afford to be quieter
 * and leave more paper. Negative space is only "empty" when nothing else is
 * there; beside an artifact it reads as composure.
 */
export const DEFAULT_FRAGMENT_COUNT = 44;
export const DEFAULT_SEED = 0x5f1741;

/**
 * Build the field. Deterministic for a given (count, seed).
 *
 * Destinations are strata: fragments settle onto a small number of horizontal
 * bands, left-aligned into a readable column. That reads as "records resolving
 * into a legible record" — the Recognition event — without ever implying a
 * relationship between two fragments.
 */
export function createFragments(
  count: number = DEFAULT_FRAGMENT_COUNT,
  seed: number = DEFAULT_SEED,
): readonly Fragment[] {
  const rand = mulberry32(seed);
  const fragments: Fragment[] = [];

  for (let id = 0; id < count; id += 1) {
    // Alternate margins so both bands read as populated at every progress.
    const band = id % 2 === 0 ? BAND_TOP : BAND_BOTTOM;
    const row = Math.floor(id / 2) % ROWS_PER_BAND;
    const span = band.max - band.min;

    // Settled: ruled rows inside the margin, spread across the full width.
    const toY = band.min + (row / (ROWS_PER_BAND - 1)) * span;
    const toX = 0.04 + rand() * 0.42;
    // Scattered: still inside the SAME margin. The field must never enter the
    // reading zone at any progress, including mid-transition — so the keep-out
    // is a property of the model, not something the renderer has to police.
    // Still biased right of its destination, so the strata travel leftward as
    // progress advances.
    const fromX = toX + 0.2 + rand() * 0.4;
    const fromY = band.min + (Math.round(rand() * (SCATTER_ROWS - 1)) / (SCATTER_ROWS - 1)) * span;

    fragments.push({
      id,
      fromX,
      fromY,
      toX,
      toY,
      width: RULED_MEASURES[Math.floor(rand() * RULED_MEASURES.length)] ?? 0.09,
      phase: rand() * Math.PI * 2,
      lane: LANES[Math.floor(rand() * LANES.length)] ?? 'neutral',
      // Roughly three rows in ten carry a tick — enough to read as a register,
      // sparse enough that the marks stay incidents rather than a pattern.
      marked: rand() < 0.3,
    });
  }

  return Object.freeze(fragments);
}

/** Smoothstep — the settle should ease, not ramp linearly. */
function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/**
 * Per-fragment stagger. Fragments settle in sequence rather than as one block,
 * so Recognition reads as evidence *arriving* instead of a layer toggling.
 * Spread over the first 70% of progress; the last 30% is the hold.
 */
function staggeredProgress(progress: number, index: number, count: number): number {
  const start = (index / Math.max(1, count)) * 0.3;
  return smoothstep((progress - start) / 0.7);
}

/**
 * Resolve one fragment's pose at a given film progress.
 *
 * @param progress 0 = Arrival (scattered, dim) … 1 = Recognition (settled, legible)
 * @param time     seconds; drives only sub-pixel drift. Pass 0 for a still
 *                 frame — the static poster and every test do exactly that,
 *                 which is why poses are reproducible.
 */
export function fragmentPose(
  fragment: Fragment,
  progress: number,
  index: number,
  count: number,
  time = 0,
): FragmentPose {
  const t = staggeredProgress(progress, index, count);

  // Drift is a whisper (≤0.6% of the stage) and dies as fragments settle:
  // motion belongs to arriving evidence, not to a restless page.
  const drift = (1 - t) * 0.006 * Math.sin(time * 0.55 + fragment.phase);

  return {
    x: fragment.fromX + (fragment.toX - fragment.fromX) * t + drift,
    y: fragment.fromY + (fragment.toY - fragment.fromY) * t + drift * 0.5,
    // Settled fragments read at a common measure; scattered ones are stubs.
    width: fragment.width * (0.55 + 0.45 * t),
    // Dim to legible. Never fully opaque — this is atmosphere behind copy, and
    // the scrim floor (SCENE_SCRIM_FLOOR) is what protects text contrast.
    //
    // Ceiling lowered from 0.52 to 0.26. At the old value the fragment field
    // was the loudest element in every frame and read as a loading skeleton
    // rather than as texture; the scenes looked noisy and unfinished at the
    // same time. Atmosphere is support for the composition, never its subject.
    opacity: 0.06 + 0.2 * t,
    lane: fragment.lane,
    marked: fragment.marked,
  };
}

/**
 * The career core's gathered light, 0–1.
 *
 * Arrival is an EMPTY core (0.08 — present but unlit, so the composition never
 * reads as a hole); Recognition is a gathered one. This is the only radial
 * element in the atmosphere and it is not a node: nothing connects to it, and
 * it carries no label, count, or identity.
 */
export function coreLight(progress: number): number {
  return 0.08 + smoothstep(progress) * 0.92;
}
