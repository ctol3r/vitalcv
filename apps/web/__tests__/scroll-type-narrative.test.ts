/**
 * Pure-function contract for the hero's TYPED narrative.
 *
 * DELIBERATE contract change (Chris, 2026-07-17): the scroll-scrubbed fill
 * became a Palantir-register TYPEWRITER — the sentence types out character by
 * character in TIME once the hero is on screen. The standing guarantees are
 * re-asserted against the time mapping: the reveal is monotonic, no letter
 * un-inks, every clause is reached in order, and the sentence completes on a
 * predictable clock (chars × NARRATIVE_CHAR_MS after the start delay).
 */

import { describe, expect, it } from 'vitest';

import {
  buildNarrativeChars,
  buildNarrativeWords,
  NARRATIVE_CHAR_MS,
  typedNarrativeState,
} from '@/components/home/ScrollTypeNarrative';

const PREFIX = 'VitalCV ';
const PHRASES = [
  'recognizes your identity',
  'checks the primary sources',
  'shows what still needs review',
  'matches the right opportunity',
  'carries your evidence forward',
] as const;

const WORDS = buildNarrativeWords(PREFIX, PHRASES);
const CHARS = buildNarrativeChars(PREFIX, PHRASES);
const TOTAL = CHARS.length;
const DELAY = 1650;
const TYPE_TIME = TOTAL * NARRATIVE_CHAR_MS;

describe('buildNarrativeWords — the typed text IS the accessible sentence', () => {
  it('reconstructs the exact homepage static sentence', () => {
    expect(WORDS.map((word) => word.text).join(' ')).toBe(
      'VitalCV recognizes your identity, checks the primary sources, shows what still needs review, matches the right opportunity, and carries your evidence forward.',
    );
  });

  it('tags every word with its clause for the progress dots', () => {
    expect(new Set(WORDS.map((word) => word.phraseIdx))).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(WORDS[0]).toEqual({ text: 'VitalCV', phraseIdx: 0 });
    expect(WORDS[WORDS.length - 1].phraseIdx).toBe(4);
  });

  it('chars reconstruct the sentence and inherit clause tags', () => {
    expect(CHARS.map((c) => c.text).join('')).toBe(
      WORDS.map((w) => w.text).join(' ').replace(/ /g, ''),
    );
    expect(new Set(CHARS.map((c) => c.phraseIdx))).toEqual(new Set([0, 1, 2, 3, 4]));
  });
});

describe('typedNarrativeState — checkpoint assertions', () => {
  it('holds at zero until the start delay elapses (the H1 is still typing)', () => {
    expect(typedNarrativeState(0, CHARS, DELAY)).toEqual({ reveal: 0, idx: 0, complete: false });
    expect(typedNarrativeState(DELAY, CHARS, DELAY).reveal).toBe(0);
  });

  it('types exactly one character per NARRATIVE_CHAR_MS after the delay', () => {
    expect(typedNarrativeState(DELAY + NARRATIVE_CHAR_MS, CHARS, DELAY).reveal).toBe(1);
    expect(typedNarrativeState(DELAY + 10 * NARRATIVE_CHAR_MS, CHARS, DELAY).reveal).toBe(10);
  });

  it('completes at delay + total × cadence, and clamps beyond', () => {
    const done = typedNarrativeState(DELAY + TYPE_TIME, CHARS, DELAY);
    expect(done).toEqual({ reveal: TOTAL, idx: 4, complete: true });
    expect(typedNarrativeState(DELAY + TYPE_TIME * 4, CHARS, DELAY)).toEqual(done);
  });
});

describe('typedNarrativeState — invariants', () => {
  it('is monotonic: more time never un-types a letter', () => {
    let previous = -1;
    for (let t = 0; t <= DELAY + TYPE_TIME + 200; t += 40) {
      const { reveal } = typedNarrativeState(t, CHARS, DELAY);
      expect(reveal).toBeGreaterThanOrEqual(previous);
      previous = reveal;
    }
  });

  it('reaches every clause in order across the sweep', () => {
    const seen: number[] = [];
    for (let t = DELAY; t <= DELAY + TYPE_TIME + NARRATIVE_CHAR_MS; t += NARRATIVE_CHAR_MS) {
      const { idx, reveal } = typedNarrativeState(t, CHARS, DELAY);
      if (reveal > 0 && seen[seen.length - 1] !== idx) seen.push(idx);
    }
    expect(seen).toEqual([0, 1, 2, 3, 4]);
  });

  it('lands the full ~130-character sentence in under 2.5 seconds of typing', () => {
    expect(TYPE_TIME).toBeLessThan(2500);
  });
});
