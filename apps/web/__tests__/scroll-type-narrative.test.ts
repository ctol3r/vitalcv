/**
 * Pure-function contract for the hero's scroll-scrubbed narrative fill.
 *
 * DELIBERATE contract change (Chris, 2026-07-16): the phrase-replace model
 * (#683 — one line visible, replaced per segment) became a CUMULATIVE dim-ink
 * scrub in the Palantir/Anyscale register: the full sentence is laid out in
 * muted ink and scroll fills it word by word, accumulating. #683's guarantees
 * are re-asserted here against the new mapping: the first clause rests inked,
 * no state is ever blank, and the fill is a pure, reversible function of
 * progress.
 */

import { describe, expect, it } from 'vitest';

import { buildNarrativeWords, narrativeStateAt } from '@/components/home/ScrollTypeNarrative';

const PREFIX = 'VitalCV ';
const PHRASES = [
  'recognizes your identity',
  'checks the primary sources',
  'shows what still needs review',
  'matches the right opportunity',
  'carries your evidence forward',
] as const;

const WORDS = buildNarrativeWords(PREFIX, PHRASES);
const TOTAL = WORDS.length;
const FIRST_CLAUSE = WORDS.filter((word) => word.phraseIdx === 0).length;

describe('buildNarrativeWords — the inked text IS the accessible sentence', () => {
  it('reconstructs the exact homepage static sentence', () => {
    expect(WORDS.map((word) => word.text).join(' ')).toBe(
      'VitalCV recognizes your identity, checks the primary sources, shows what still needs review, matches the right opportunity, and carries your evidence forward.',
    );
  });

  it('tags every word with its clause for the progress dots', () => {
    expect(new Set(WORDS.map((word) => word.phraseIdx))).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(WORDS[0]).toEqual({ text: 'VitalCV', phraseIdx: 0 });
    expect(WORDS[TOTAL - 1].phraseIdx).toBe(4);
  });
});

describe('narrativeStateAt — checkpoint assertions', () => {
  it('rest (0%): the first clause is inked, nothing more', () => {
    expect(narrativeStateAt(0, WORDS)).toEqual({ reveal: FIRST_CLAUSE, idx: 0, complete: false });
  });

  it('tiny scroll (2%): still resting on the first clause — no wipe, no regression', () => {
    const state = narrativeStateAt(0.02, WORDS);
    expect(state.reveal).toBeGreaterThanOrEqual(FIRST_CLAUSE);
    expect(state.idx).toBe(0);
  });

  it('100%: fully inked, and clamps beyond 1 and below 0', () => {
    expect(narrativeStateAt(1, WORDS)).toEqual({ reveal: TOTAL, idx: 4, complete: true });
    expect(narrativeStateAt(1.4, WORDS)).toEqual(narrativeStateAt(1, WORDS));
    expect(narrativeStateAt(-0.5, WORDS)).toEqual(narrativeStateAt(0, WORDS));
  });
});

describe('narrativeStateAt — invariants', () => {
  it('accumulates monotonically: more scroll never un-inks a word', () => {
    let previous = -1;
    for (let p = 0; p <= 1.001; p += 0.01) {
      const { reveal } = narrativeStateAt(p, WORDS);
      expect(reveal).toBeGreaterThanOrEqual(previous);
      previous = reveal;
    }
  });

  it('reaches every clause in order across the sweep', () => {
    const seen: number[] = [];
    for (let p = 0; p <= 1.001; p += 0.01) {
      const { idx } = narrativeStateAt(p, WORDS);
      if (seen[seen.length - 1] !== idx) seen.push(idx);
    }
    expect(seen).toEqual([0, 1, 2, 3, 4]);
  });

  it('never renders a blank state at any progress', () => {
    for (let p = -0.2; p <= 1.2; p += 0.017) {
      expect(narrativeStateAt(p, WORDS).reveal).toBeGreaterThanOrEqual(1);
    }
  });

  it('completes just before the end of the runway (a natural closing beat)', () => {
    expect(narrativeStateAt(0.99, WORDS).complete).toBe(true);
    expect(narrativeStateAt(0.9, WORDS).complete).toBe(false);
  });

  it('is a pure function of progress — reverse scrolling un-fills exactly', () => {
    const forward = [0.15, 0.4, 0.75].map((p) => narrativeStateAt(p, WORDS));
    narrativeStateAt(0.95, WORDS);
    const backward = [0.75, 0.4, 0.15].map((p) => narrativeStateAt(p, WORDS)).reverse();
    expect(backward).toEqual(forward);
  });
});
