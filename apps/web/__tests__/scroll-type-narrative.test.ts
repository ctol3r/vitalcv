/**
 * scroll-type-narrative.test.ts — the pure scroll→narrative mapping.
 *
 * Locks the audit's polish contract: begin fully stable (a few pixels of
 * scroll must NOT wipe the first phrase — the old `p < 0.005` special case
 * collapsed to 0 words at p≈0.006), every phrase gets a readable dwell (typing
 * completes by 50% of its segment), no blank frames (≥1 word while typing),
 * and reversing is deterministic (pure function of progress).
 */
import { describe, expect, it } from 'vitest';

import { narrativeStateAt } from '@/components/home/ScrollTypeNarrative';

// The real homepage sequence (word counts: 3, 4, 5, 4, 4).
const PHRASES = [
  'recognizes your identity',
  'checks the primary sources',
  'shows what still needs review',
  'matches the right opportunity',
  'carries your evidence forward',
] as const;

const words = (i: number) => PHRASES[i].split(' ').length;

describe('narrativeStateAt — checkpoint assertions (start, 5%, 20%, 50%, 80%, 100%)', () => {
  it('start (0%): first phrase fully shown', () => {
    expect(narrativeStateAt(0, PHRASES)).toEqual({ idx: 0, shown: words(0) });
  });

  it('5%: first phrase STILL fully shown — the tiny-scroll wipe is gone', () => {
    // Regression: the old math returned shown=0 here, blanking the line.
    expect(narrativeStateAt(0.05, PHRASES)).toEqual({ idx: 0, shown: words(0) });
  });

  it('20%: second phrase has begun (≥1 word, never blank)', () => {
    const s = narrativeStateAt(0.2, PHRASES);
    expect(s.idx).toBe(1);
    expect(s.shown).toBeGreaterThanOrEqual(1);
  });

  it('50%: third phrase fully typed and dwelling', () => {
    expect(narrativeStateAt(0.5, PHRASES)).toEqual({ idx: 2, shown: words(2) });
  });

  it('80%: fifth phrase has begun', () => {
    const s = narrativeStateAt(0.8, PHRASES);
    expect(s.idx).toBe(4);
    expect(s.shown).toBeGreaterThanOrEqual(1);
  });

  it('100%: fifth phrase fully shown (and clamps beyond 1)', () => {
    expect(narrativeStateAt(1, PHRASES)).toEqual({ idx: 4, shown: words(4) });
    expect(narrativeStateAt(1.4, PHRASES)).toEqual({ idx: 4, shown: words(4) });
  });
});

describe('narrativeStateAt — invariants', () => {
  it('never renders a blank line at any progress (≥1 word everywhere)', () => {
    for (let p = 0; p <= 1.001; p += 0.01) {
      expect(narrativeStateAt(p, PHRASES).shown).toBeGreaterThanOrEqual(1);
    }
  });

  it('every phrase reaches fully-typed with a dwell (second half of its segment)', () => {
    for (let i = 0; i < PHRASES.length; i += 1) {
      // Sample the 75% point of each segment — typing finished, still dwelling.
      const p = (i + 0.75) / PHRASES.length;
      expect(narrativeStateAt(p, PHRASES)).toEqual({ idx: i, shown: words(i) });
    }
  });

  it('is a pure function of progress — reverse scrolling reverses exactly', () => {
    const forward = narrativeStateAt(0.35, PHRASES);
    const afterRoundTrip = narrativeStateAt(0.35, PHRASES);
    expect(afterRoundTrip).toEqual(forward);
    expect(narrativeStateAt(0, PHRASES)).toEqual({ idx: 0, shown: words(0) });
  });
});
