import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FRAGMENT_COUNT,
  createFragments,
  fragmentPose,
} from '@/components/home/film/atmosphere';
import { readingCorridor } from '../tests/e2e/film-reading-corridor';

/**
 * Model half of the copy-legibility invariant (see film-reading-corridor.ts).
 *
 * #886 moved the fix from "scrim over the fragments" to "fragments never enter
 * the reading zone". That is a property of the model, so it can be proven here
 * — cheaply, deterministically, and for every renderer at once, since the SSR
 * poster, Canvas 2D and WebGPU tiers all consume `fragmentPose`.
 *
 * The DOM half — that `.film-copy` actually sits inside the corridor this
 * leaves empty — is in `tests/e2e/film-composition.spec.ts`. Neither half is
 * sufficient alone: fragments could keep out of a corridor the copy doesn't
 * occupy, or copy could sit in a corridor the fragments invade.
 */
describe('atmosphere leaves a reading corridor', () => {
  it('measures a corridor wide enough to hold the copy', () => {
    const { top, bottom } = readingCorridor();

    expect(bottom).toBeGreaterThan(top);
    // Half the stage is the floor: the copy column is the tallest thing on the
    // frame, and a corridor narrower than this would mean the bands have grown
    // enough to start crowding it even if no single fragment overlaps yet.
    expect(bottom - top).toBeGreaterThanOrEqual(0.5);
  });

  it('keeps every fragment out of the corridor at every progress', () => {
    const { top, bottom } = readingCorridor();
    const fragments = createFragments();
    expect(fragments).toHaveLength(DEFAULT_FRAGMENT_COUNT);

    // Sampled finely, and deliberately including values BETWEEN scene
    // boundaries: the field is in flight mid-transition, which is exactly where
    // an endpoint-only check would miss an excursion into the reading zone.
    const intrusions: Array<{ progress: number; id: number; y: number }> = [];
    for (let step = 0; step <= 80; step += 1) {
      const progress = step / 80;
      fragments.forEach((fragment, i) => {
        const { y } = fragmentPose(fragment, progress, i, fragments.length, 0);
        if (y > top && y < bottom) intrusions.push({ progress, id: fragment.id, y });
      });
    }

    expect(intrusions).toEqual([]);
  });

  /**
   * The bands must be structural, not a happy accident of the default seed.
   *
   * Stated as "every configuration leaves a wide corridor" rather than "every
   * fragment avoids THE corridor". The stricter-looking version is a trap: the
   * corridor is measured from a field, `fragmentPose` applies a sine drift, and
   * so a fragment settles a few thousandths outside its band in a
   * seed-dependent place. Measuring with one seed and asserting against another
   * reported a 0.003 intrusion that was an artefact of the comparison, not a
   * property of the model.
   */
  it('leaves a wide corridor at every fragment count and seed', () => {
    for (const [count, seed] of [
      [12, 1],
      [44, 0x5f1741],
      [96, 0xbeef],
      [200, 0x1234],
    ] as const) {
      const { top, bottom } = readingCorridor(count, seed);
      expect(
        bottom - top,
        `count=${count} seed=${seed} corridor ${top.toFixed(3)}–${bottom.toFixed(3)} is too narrow`,
      ).toBeGreaterThanOrEqual(0.5);
      // And the corridor must be genuinely central — bands pinned to the
      // margins, not one fat band and a sliver.
      expect(top, `count=${count} top band reaches too far down`).toBeLessThanOrEqual(0.25);
      expect(bottom, `count=${count} bottom band reaches too far up`).toBeGreaterThanOrEqual(0.75);
    }
  });
});
