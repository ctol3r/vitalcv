import { describe, expect, it } from 'vitest';

import { FIELD_ANCHORS, MODEL } from '@/components/home/evidence-field/model';
import {
  computeViewProj,
  makeToWorld,
  projectToNdc,
} from '@/components/home/evidence-field/webgpu';

/**
 * The WebGPU field's projection, asserted without a GPU.
 *
 * This exists because of a production failure that every other layer of
 * testing was blind to: the renderer built `view × projection` instead of
 * `projection × view`, which collapses every vertex to w = 0. WebGPU init
 * still succeeded, no error surfaced, the canvas stayed attached at opacity 1,
 * and the tier never fell back — it simply drew nothing, leaving the static
 * SVG poster as the entire hero on every WebGPU-capable browser.
 *
 * The e2e suite only asserted that a canvas ELEMENT existed for the GPU tier,
 * and the painted-pixels test forced `?sceneTier=canvas2d`. So the whole 3D
 * component could be blank and CI stayed green. These are pure-math checks on
 * the exported camera, so they run everywhere, every time.
 */

/** Panel aspects the field actually renders at: mobile 16/10 → tall desktop. */
const ASPECTS = [16 / 10, 464 / 448, 1, 464 / 608, 0.7];

describe('career evidence field — GPU projection', () => {
  it('projects the composition in front of the camera, never to a degenerate w', () => {
    for (const aspect of ASPECTS) {
      const { viewProj } = computeViewProj(aspect, 0, 0);
      const toWorld = makeToWorld(aspect);
      for (const [i, atom] of MODEL.atoms.entries()) {
        const ndc = projectToNdc(viewProj, toWorld(atom.x, atom.y, atom.z));
        expect(ndc, `atom ${i} at aspect ${aspect.toFixed(2)} must be drawable`).not.toBeNull();
        expect(ndc!.z).toBeGreaterThanOrEqual(0);
        expect(ndc!.z).toBeLessThanOrEqual(1);
      }
    }
  });

  it('fits every atom inside the panel at every aspect it renders at', () => {
    for (const aspect of ASPECTS) {
      const { viewProj } = computeViewProj(aspect, 0, 0);
      const toWorld = makeToWorld(aspect);
      for (const [i, atom] of MODEL.atoms.entries()) {
        const ndc = projectToNdc(viewProj, toWorld(atom.x, atom.y, atom.z))!;
        // The HERO-RESET-1 failure in a different costume: geometry that is
        // technically rendered but cropped outside the visible panel.
        expect(Math.abs(ndc.x), `atom ${i} x in frame @ ${aspect.toFixed(2)}`).toBeLessThan(1);
        expect(Math.abs(ndc.y), `atom ${i} y in frame @ ${aspect.toFixed(2)}`).toBeLessThan(1);
      }
    }
  });

  it('lands every named anchor under its HTML label, which is placed by the same coordinates', () => {
    const aspect = 464 / 448;
    const { viewProj } = computeViewProj(aspect, 0, 0);
    const toWorld = makeToWorld(aspect);
    for (const anchor of FIELD_ANCHORS) {
      const ndc = projectToNdc(viewProj, toWorld(anchor.x, anchor.y, 0))!;
      // NDC → normalized panel coordinates, which is exactly what the label
      // overlay uses for `left`/`top`. The z = 0 plane is fitted to the panel
      // rect, so these must agree to within rounding.
      expect(ndc.x / 2 + 0.5, `${anchor.id} x`).toBeCloseTo(anchor.x, 5);
      expect(0.5 - ndc.y / 2, `${anchor.id} y`).toBeCloseTo(anchor.y, 5);
    }
  });

  it('keeps named stations under their labels through the full camera orbit', () => {
    const aspect = 464 / 448;
    const toWorld = makeToWorld(aspect);
    // Orbit extremes: idle drift (±0.07 yaw, ±0.045 pitch) plus a pointer
    // pinned to a corner (±0.5 → ±0.06 yaw, ±0.045 pitch).
    const yaw = 0.5 * 0.12 + 0.07;
    const pitch = 0.5 * 0.09 + 0.045;
    for (const [dy, dp] of [
      [yaw, pitch],
      [-yaw, -pitch],
      [yaw, -pitch],
      [-yaw, pitch],
    ]) {
      const { viewProj } = computeViewProj(aspect, dy, dp);
      for (const anchor of FIELD_ANCHORS) {
        const ndc = projectToNdc(viewProj, toWorld(anchor.x, anchor.y, 0))!;
        const driftX = Math.abs(ndc.x / 2 + 0.5 - anchor.x);
        const driftY = Math.abs(0.5 - ndc.y / 2 - anchor.y);
        // Parallax is the point; a station wandering out from under the word
        // that names it is not. 4% of the panel keeps them visibly paired.
        expect(driftX, `${anchor.id} x drift`).toBeLessThan(0.04);
        expect(driftY, `${anchor.id} y drift`).toBeLessThan(0.04);
      }
    }
  });

  it('gives unlabelled texture atoms real depth — the field is not a flat plane', () => {
    const depths = MODEL.atoms.map((a) => a.z).filter((z) => Math.abs(z) > 0.05);
    expect(depths.length, 'seeded atoms must carry z').toBeGreaterThan(4);

    // Depth has to produce actual parallax under the orbit, or "3D" is a claim
    // rather than a rendering.
    const aspect = 464 / 448;
    const toWorld = makeToWorld(aspect);
    const near = MODEL.atoms.reduce((a, b) => (a.z > b.z ? a : b));
    const at = (yaw: number) =>
      projectToNdc(computeViewProj(aspect, yaw, 0).viewProj, toWorld(near.x, near.y, near.z))!.x;
    expect(Math.abs(at(0.12) - at(-0.12)), 'a near atom must parallax').toBeGreaterThan(0.01);
  });
});
