import { describe, expect, it } from 'vitest';

import {
  BLEND_WINDOW,
  blendSceneParams,
  resolveProgress,
  smoothstep,
  type ChapterSpan,
} from '@/components/home/scene/progress';
import {
  getChapterScene,
  SCENE_SCRIM_FLOOR,
} from '@/components/home/scene/registry';

// SHD-1.3 model contract: one pure function of scroll position drives every
// scroll-coupled visual. Purity IS the reverse-scroll guarantee — the same
// anchor always resolves the same journey state, forward or backward.

const SPANS: ChapterSpan[] = [
  { id: 'wallet', top: 0 },
  { id: 'readiness', top: 1000 },
  { id: 'matcha', top: 2000 },
  { id: 'apply', top: 3000 },
  { id: 'employers', top: 4000 },
];
const END = 5000;

describe('resolveProgress (SHD-1.3)', () => {
  it('returns null with no chapters and never throws on one chapter', () => {
    expect(resolveProgress(500, [], END)).toBeNull();
    const solo = resolveProgress(120, [{ id: 'wallet', top: 0 }], 400);
    expect(solo?.index).toBe(0);
    expect(solo?.blend.t).toBeGreaterThanOrEqual(0);
  });

  it('clamps before the first chapter and past the last', () => {
    const before = resolveProgress(-500, SPANS, END)!;
    expect(before.index).toBe(0);
    expect(before.local).toBe(0);
    const past = resolveProgress(99999, SPANS, END)!;
    expect(past.index).toBe(4);
    expect(past.local).toBe(1);
  });

  it('mid-span is the pure chapter scene (no blend)', () => {
    const p = resolveProgress(2500, SPANS, END)!;
    expect(p.index).toBe(2);
    expect(p.id).toBe('matcha');
    expect(p.local).toBeCloseTo(0.5);
    expect(p.blend.t).toBe(0);
    expect(p.blend.from.id).toBe('matcha');
  });

  it('global progress is continuous and monotonic in scroll position', () => {
    let prev = -1;
    for (let y = -100; y <= 5200; y += 50) {
      const g = resolveProgress(y, SPANS, END)!.global;
      expect(g).toBeGreaterThanOrEqual(prev);
      prev = g;
    }
  });

  it('is a pure function: forward and reverse scrubbing agree exactly', () => {
    const forward = [1234, 2718, 3999].map((y) => resolveProgress(y, SPANS, END));
    const reverse = [3999, 2718, 1234].map((y) => resolveProgress(y, SPANS, END)).reverse();
    expect(forward).toEqual(reverse);
  });

  it('crossfades within the blend window and lands continuous at the boundary', () => {
    // entering the final BLEND_WINDOW of chapter 1 → t rises toward 1
    const inWindow = resolveProgress(1000 + 1000 * (1 - BLEND_WINDOW / 2), SPANS, END)!;
    expect(inWindow.blend.t).toBeGreaterThan(0);
    expect(inWindow.blend.from.id).toBe('evidence'); // readiness → alias
    expect(inWindow.blend.to.id).toBe('matcha');
    // just before the boundary: nearly pure `to`
    const nearEnd = resolveProgress(1999, SPANS, END)!;
    expect(nearEnd.blend.t).toBeGreaterThan(0.95);
    // just after: new chapter, t=0, from === the scene we faded into
    const after = resolveProgress(2001, SPANS, END)!;
    expect(after.blend.t).toBe(0);
    expect(after.blend.from.id).toBe('matcha');
  });

  it('resolves the readiness DOM id to the canonical evidence scene', () => {
    expect(getChapterScene('readiness').id).toBe('evidence');
    const p = resolveProgress(1500, SPANS, END)!;
    expect(p.id).toBe('readiness'); // DOM id preserved for the rail
    expect(p.blend.from.id).toBe('evidence'); // scene resolved canonically
  });
});

describe('smoothstep', () => {
  it('clamps to [0,1] with smooth endpoints', () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(0.5)).toBeCloseTo(0.5);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(2)).toBe(1);
  });
});

describe('blendSceneParams', () => {
  const a = getChapterScene('wallet');
  const b = getChapterScene('matcha');

  it('returns pure endpoints at t=0 and t=1', () => {
    expect(blendSceneParams({ from: a, to: b, t: 0 })).toEqual({
      flow: a.flow,
      wake: a.wake,
      scrim: a.scrim,
      grain: a.grain,
    });
    expect(blendSceneParams({ from: a, to: b, t: 1 })).toEqual({
      flow: b.flow,
      wake: b.wake,
      scrim: b.scrim,
      grain: b.grain,
    });
  });

  it('never drops the scrim below the legibility floor at ANY blend point', () => {
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const p = blendSceneParams({ from: a, to: b, t: Math.min(1, t) });
      expect(p.scrim).toBeGreaterThanOrEqual(SCENE_SCRIM_FLOOR);
    }
  });
});
