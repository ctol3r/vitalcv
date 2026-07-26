import { createFragments, fragmentPose } from '@/components/home/film/atmosphere';

/**
 * The reading corridor — derived from the atmosphere model, never hardcoded.
 *
 * #886 fixed the copy-legibility bug at the model level: fragments settle into
 * a top and a bottom margin band and never enter the space between them. The
 * invariant that follows is the one worth guarding, and it is OUTCOME-based:
 *
 *     no atmosphere fragment may share vertical space with any `.film-copy` box
 *
 * A previous attempt (#887) asserted the *mechanism* instead — "a scrim exists
 * behind the copy" — which is why it was rejected: under #886 the scrim is
 * correctly absent, so that test would have failed against a page where the bug
 * is genuinely fixed. A test that fails on correct code is worse than no test.
 *
 * The bands are private to `atmosphere.ts`, and deliberately not re-exported:
 * duplicating `0.2` and `0.82` here would let the model widen its bands while
 * the test kept passing against stale numbers. Instead the corridor is measured
 * from `fragmentPose` across the whole progress range, so it is whatever the
 * model actually leaves empty — including mid-transition, where the field is in
 * flight and a naive endpoint-only check would miss an excursion.
 *
 * ASSUMPTION, stated so it can be revisited: this is the right invariant while
 * separation is what protects the copy. If a future change goes back to
 * scrimming fragments *behind* the text, overlap becomes legitimate and the
 * DOM-side half of this guard has to change with it. The model-side half holds
 * either way.
 */

/** Progress samples: both endpoints, the scene boundaries, and mid-transitions. */
const SAMPLES = Array.from({ length: 41 }, (_, i) => i / 40);

export interface Corridor {
  /** Bottom edge of the top band — the corridor starts here. */
  readonly top: number;
  /** Top edge of the bottom band — the corridor ends here. */
  readonly bottom: number;
}

/**
 * Measure the vertical space the atmosphere never occupies, as a 0–1 fraction
 * of the stage.
 *
 * Parameterised by `count`/`seed` because the corridor is a property of a
 * specific field, not a global constant: `fragmentPose` applies a sine drift, so
 * a fragment can settle a few thousandths outside its band and where that
 * happens depends on the seed. Measuring one configuration and asserting
 * against another therefore reports a phantom intrusion of ~0.003 — which is
 * what a first version of this helper did.
 */
export function readingCorridor(count?: number, seed?: number): Corridor {
  const fragments = createFragments(count, seed);

  // Walk every fragment at every sampled progress and record where the field
  // reaches. `fragmentPose` is the single function every renderer consumes —
  // the SSR poster, the Canvas 2D tier, and WebGPU alike — so measuring it
  // measures all of them.
  let topReach = 0; // furthest DOWN the top band extends
  let bottomReach = 1; // furthest UP the bottom band extends

  for (const progress of SAMPLES) {
    fragments.forEach((fragment, i) => {
      const { y } = fragmentPose(fragment, progress, i, fragments.length, 0);
      // Which band a fragment belongs to is a property of the model, not
      // something to assume from its index: classify by which half it sits in.
      if (y < 0.5) topReach = Math.max(topReach, y);
      else bottomReach = Math.min(bottomReach, y);
    });
  }

  return { top: topReach, bottom: bottomReach };
}
