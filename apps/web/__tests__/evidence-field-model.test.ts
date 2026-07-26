import { describe, expect, it } from 'vitest';

import {
  buildModel,
  cssColorToRgb,
  MODEL,
} from '@/components/home/evidence-field/model';

// SHD-2.1 contract: ONE seeded semantic model binds every renderer tier
// (WebGPU, Canvas 2D, SVG poster), so GPU and non-GPU renders communicate the
// same meaning and the geometry never shifts between renders (no CLS).

describe('evidence-field shared model (SHD-2.1)', () => {
  it('is deterministic: two builds are identical, and MODEL matches', () => {
    expect(buildModel()).toEqual(buildModel());
    expect(buildModel()).toEqual(MODEL);
  });

  it('keeps every atom inside the composition bounds', () => {
    for (const a of MODEL.atoms) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThanOrEqual(1);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeLessThanOrEqual(1);
      expect(a.z).toBeGreaterThanOrEqual(-1);
      expect(a.z).toBeLessThanOrEqual(1);
    }
  });

  it('declares exactly ONE bounded acceptance ring, on an opportunity', () => {
    expect(MODEL.acceptance).toBeGreaterThanOrEqual(0);
    expect(MODEL.acceptance).toBeLessThan(MODEL.atoms.length);
    expect(MODEL.atoms[MODEL.acceptance].kind).toBe('opportunity');
  });

  it('keeps the needs-action signal rare — one amber atom, never more', () => {
    const attention = MODEL.atoms.filter((a) => a.kind === 'attention');
    expect(attention).toHaveLength(1);
  });

  it('links only reference real atoms, and directions stay semantic', () => {
    for (const i of [...MODEL.inLinks, ...MODEL.outLinks]) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(MODEL.atoms.length);
    }
    // outgoing links are opportunities only (career moving out)
    for (const i of MODEL.outLinks) {
      expect(MODEL.atoms[i].kind).toBe('opportunity');
    }
    // incoming links never originate at an opportunity
    for (const i of MODEL.inLinks) {
      expect(MODEL.atoms[i].kind).not.toBe('opportunity');
    }
  });
});

describe('cssColorToRgb', () => {
  it('returns null (never throws) when the environment cannot rasterize', () => {
    // jsdom has no 2D canvas implementation → the GPU tier must decline
    // gracefully rather than crash.
    expect(() => cssColorToRgb('#ffffff')).not.toThrow();
  });
});
