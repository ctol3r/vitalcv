import { describe, expect, it } from 'vitest';

import {
  railRunwayHeight,
  resolveRail,
  scrollForChapter,
} from '@/components/home/rail/geometry';

// SHD-3.1 rail geometry: translation is a pure function of scrollY, so the
// browser keeps ownership of scroll (no jacking) and forward/reverse scrubbing
// are symmetric.

const VH = 800;
const N = 6;

describe('railRunwayHeight', () => {
  it('reserves one viewport of pin plus a dwell per transition', () => {
    // (6 − 1) transitions × 1 dwell × 800 + 800 pin = 4800
    expect(railRunwayHeight(N, VH, 1)).toBe(4800);
    expect(railRunwayHeight(N, VH, 1.5)).toBe(6800);
  });
  it('never collapses below one viewport for a single chapter', () => {
    expect(railRunwayHeight(1, VH)).toBe(VH);
    expect(railRunwayHeight(0, VH)).toBe(VH);
  });
});

describe('resolveRail', () => {
  const runwayTop = 1000;
  const runwayHeight = railRunwayHeight(N, VH, 1); // 4800, travel = 4000

  it('is fully left at/above the runway top', () => {
    const g = resolveRail(runwayTop, runwayTop, runwayHeight, VH, N);
    expect(g.progress).toBe(0);
    expect(g.activeIndex).toBe(0);
    expect(g.translatePercent).toBe(0);
    const before = resolveRail(0, runwayTop, runwayHeight, VH, N);
    expect(before.progress).toBe(0);
  });

  it('is fully right at/after the runway end', () => {
    const g = resolveRail(runwayTop + 4000, runwayTop, runwayHeight, VH, N);
    expect(g.progress).toBe(1);
    expect(g.activeIndex).toBe(N - 1);
    expect(g.translatePercent).toBe((N - 1) * 100); // 500vw
    const past = resolveRail(runwayTop + 99999, runwayTop, runwayHeight, VH, N);
    expect(past.progress).toBe(1);
  });

  it('translates continuously and monotonically with scroll', () => {
    let prev = -1;
    for (let y = runwayTop - 200; y <= runwayTop + 4200; y += 100) {
      const g = resolveRail(y, runwayTop, runwayHeight, VH, N);
      expect(g.translatePercent).toBeGreaterThanOrEqual(prev);
      prev = g.translatePercent;
    }
  });

  it('picks the nearest chapter for the active index', () => {
    // midway → chapter 2/3 boundary at progress 0.5 → round(0.5*5)=3 (index)
    const mid = resolveRail(runwayTop + 2000, runwayTop, runwayHeight, VH, N);
    expect(mid.progress).toBeCloseTo(0.5);
    expect(mid.activeIndex).toBe(3);
  });

  it('reverse scrub reproduces forward values exactly (pure function)', () => {
    const ys = [runwayTop + 400, runwayTop + 1600, runwayTop + 3200];
    const fwd = ys.map((y) => resolveRail(y, runwayTop, runwayHeight, VH, N).translatePercent);
    const rev = ys
      .slice()
      .reverse()
      .map((y) => resolveRail(y, runwayTop, runwayHeight, VH, N).translatePercent)
      .reverse();
    expect(fwd).toEqual(rev);
  });
});

describe('scrollForChapter', () => {
  const runwayTop = 1000;
  const runwayHeight = railRunwayHeight(N, VH, 1);

  it('lands each chapter at an evenly spaced rest position', () => {
    expect(scrollForChapter(0, runwayTop, runwayHeight, VH, N)).toBe(1000);
    expect(scrollForChapter(N - 1, runwayTop, runwayHeight, VH, N)).toBe(5000);
    expect(scrollForChapter(3, runwayTop, runwayHeight, VH, N)).toBe(1000 + Math.round((3 / 5) * 4000));
  });

  it('clamps out-of-range indices', () => {
    expect(scrollForChapter(-5, runwayTop, runwayHeight, VH, N)).toBe(1000);
    expect(scrollForChapter(99, runwayTop, runwayHeight, VH, N)).toBe(5000);
  });

  it('round-trips: scrollForChapter(i) resolves back to active index i', () => {
    for (let i = 0; i < N; i++) {
      const y = scrollForChapter(i, runwayTop, runwayHeight, VH, N);
      expect(resolveRail(y, runwayTop, runwayHeight, VH, N).activeIndex).toBe(i);
    }
  });
});
