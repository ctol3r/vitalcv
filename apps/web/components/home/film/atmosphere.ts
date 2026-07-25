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
}

export interface FragmentPose {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly opacity: number;
  readonly lane: FragmentLane;
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

export const DEFAULT_FRAGMENT_COUNT = 64;
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
  const bands = 11;

  for (let id = 0; id < count; id += 1) {
    const band = id % bands;
    // Settled: left-anchored strata with a slight organic x offset.
    const toY = 0.16 + (band / (bands - 1)) * 0.68;
    const toX = 0.08 + rand() * 0.06;
    // Scattered: anywhere across the stage, biased right so the field
    // *travels* leftward into the core as progress advances.
    const fromX = 0.18 + rand() * 0.78;
    const fromY = rand();

    fragments.push({
      id,
      fromX,
      fromY,
      toX,
      toY,
      width: 0.05 + rand() * 0.22,
      phase: rand() * Math.PI * 2,
      lane: LANES[Math.floor(rand() * LANES.length)] ?? 'neutral',
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
    opacity: 0.1 + 0.42 * t,
    lane: fragment.lane,
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
