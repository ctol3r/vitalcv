/**
 * Motion M1 — the pure character-reveal model.
 *
 * These pin the contract the component depends on: words stay whole (so lines
 * can only break between them), graphemes are never torn, punctuation and
 * intentional breaks survive, and the scroll→character mapping is a clamped,
 * reversible pure function.
 */

import { describe, expect, it } from 'vitest';

import {
  characterProgress,
  characterWindow,
  clamp01,
  LONG_HEADING_CHARACTERS,
  resolveVariant,
  sceneCharacterWindow,
  segmentHeading,
  toGraphemes,
} from '@/lib/motion/characterReveal';

describe('toGraphemes — never tear a character in half', () => {
  it('keeps a combining accent with its base letter', () => {
    // 'é' as e + U+0301: one grapheme, two code points. split('') would break
    // it into a bare "e" and a floating accent.
    const decomposed = 'André';
    expect(toGraphemes(decomposed)).toEqual(['A', 'n', 'd', 'r', 'é']);
    expect(toGraphemes(decomposed).join('')).toBe(decomposed);
  });

  it('keeps precomposed accents, apostrophes and em dashes intact', () => {
    expect(toGraphemes('clinician’s')).toContain('’');
    expect(toGraphemes('start—faster')).toContain('—');
    expect(toGraphemes('José').join('')).toBe('José');
  });
});

describe('segmentHeading — words stay whole', () => {
  const heading = segmentHeading('Your evidence should move with you.');

  it('splits into words, not letters, and preserves the sentence', () => {
    expect(heading.words.map((word) => word.text)).toEqual([
      'Your',
      'evidence',
      'should',
      'move',
      'with',
      'you.',
    ]);
    expect(heading.words.map((word) => word.characters.join('')).join(' ')).toBe(
      'Your evidence should move with you.',
    );
  });

  it('keeps trailing punctuation attached to its word', () => {
    expect(heading.words.at(-1)!.characters).toEqual(['y', 'o', 'u', '.']);
  });

  it('assigns contiguous character offsets across the heading', () => {
    let expected = 0;
    for (const word of heading.words) {
      expect(word.characterOffset).toBe(expected);
      expected += word.characters.length;
    }
    expect(heading.characterCount).toBe(expected);
    // Spaces are layout, not animated characters.
    expect(heading.characterCount).toBe('Yourevidenceshouldmovewithyou.'.length);
  });

  it('preserves intentional line breaks as line boundaries', () => {
    const multi = segmentHeading('Prove your career\nonce.');
    expect(multi.lines).toHaveLength(2);
    expect(multi.lines[0].map((w) => w.text)).toEqual(['Prove', 'your', 'career']);
    expect(multi.lines[1].map((w) => w.text)).toEqual(['once.']);
  });

  it('collapses whitespace runs without inventing empty words', () => {
    const spaced = segmentHeading('Evidence   that    moves');
    expect(spaced.words.map((w) => w.text)).toEqual(['Evidence', 'that', 'moves']);
  });
});

describe('segmentHeading — accent phrases', () => {
  it('marks every word of a multi-word accent phrase, and only those', () => {
    const heading = segmentHeading('Evidence that moves with you.', ['moves with you.']);
    expect(heading.words.filter((w) => w.accent).map((w) => w.text)).toEqual([
      'moves',
      'with',
      'you.',
    ]);
    expect(heading.words.filter((w) => !w.accent).map((w) => w.text)).toEqual([
      'Evidence',
      'that',
    ]);
  });

  it('ignores an accent phrase that is not present', () => {
    const heading = segmentHeading('One career record.', ['not in the text']);
    expect(heading.words.every((w) => !w.accent)).toBe(true);
  });

  it('accents nothing by default', () => {
    expect(segmentHeading('One career record.').words.every((w) => !w.accent)).toBe(true);
  });
});

describe('characterWindow — staggered thresholds', () => {
  it('first character starts at 0, last completes at ~0.9 (leaving a hold)', () => {
    const n = 20;
    expect(characterWindow(0, n).start).toBe(0);
    const last = characterWindow(n - 1, n);
    expect(last.start).toBeCloseTo(0.72, 5);
    expect(last.end).toBeCloseTo(0.9, 5);
    // The final ~10% of the section holds the completed heading.
    expect(last.end).toBeLessThan(1);
  });

  it('windows advance monotonically and overlap (assembly, not a queue)', () => {
    const n = 12;
    let previous = -1;
    for (let i = 0; i < n; i++) {
      const { start, end } = characterWindow(i, n);
      expect(start).toBeGreaterThan(previous);
      expect(end).toBeGreaterThan(start);
      previous = start;
    }
    // Neighbours overlap: characters resolve in a wave, not one at a time.
    expect(characterWindow(1, n).start).toBeLessThan(characterWindow(0, n).end);
  });

  it('handles a single-character heading without dividing by zero', () => {
    const { start, end } = characterWindow(0, 1);
    expect(Number.isFinite(start)).toBe(true);
    expect(end).toBeGreaterThan(start);
  });
});

describe('sceneCharacterWindow — cinematic overlap and hold', () => {
  it('finishes by 86% so the resolved statement holds before release', () => {
    const n = 48;
    const last = sceneCharacterWindow(n - 1, n, 2);
    expect(last.end).toBeLessThanOrEqual(0.86);
    expect(last.end).toBeLessThan(1);
  });

  it('uses line-aware wave offsets instead of one identical path', () => {
    const firstLine = sceneCharacterWindow(12, 48, 0);
    const nextLine = sceneCharacterWindow(12, 48, 1);
    expect(nextLine.start).not.toBe(firstLine.start);
    expect(nextLine.end).not.toBe(firstLine.end);
  });

  it('keeps every reveal window finite and overlapping', () => {
    for (let index = 0; index < 48; index += 1) {
      const window = sceneCharacterWindow(index, 48, index < 18 ? 0 : index < 37 ? 1 : 2);
      expect(Number.isFinite(window.start)).toBe(true);
      expect(window.end).toBeGreaterThan(window.start);
      expect(window.end - window.start).toBeLessThanOrEqual(0.23 + Number.EPSILON);
    }
  });
});

describe('characterProgress — clamped, pure, reversible', () => {
  const n = 10;

  it('clamps to 0 before its window and 1 after', () => {
    expect(characterProgress(0, 5, n)).toBe(0);
    expect(characterProgress(1, 5, n)).toBe(1);
    expect(characterProgress(-3, 5, n)).toBe(0);
    expect(characterProgress(99, 5, n)).toBe(1);
  });

  it('is monotonic across the sweep for every character', () => {
    for (let i = 0; i < n; i++) {
      let previous = -1;
      for (let p = 0; p <= 1.0001; p += 0.02) {
        const value = characterProgress(p, i, n);
        expect(value).toBeGreaterThanOrEqual(previous);
        previous = value;
      }
    }
  });

  it('REVERSES exactly — scrolling up reproduces the identical state', () => {
    const forward = [0.1, 0.35, 0.6, 0.85].map((p) =>
      Array.from({ length: n }, (_, i) => characterProgress(p, i, n)),
    );
    const backward = [0.85, 0.6, 0.35, 0.1]
      .map((p) => Array.from({ length: n }, (_, i) => characterProgress(p, i, n)))
      .reverse();
    expect(backward).toEqual(forward);
  });

  it('earlier characters are always at least as resolved as later ones', () => {
    for (const p of [0.15, 0.4, 0.65, 0.88]) {
      const values = Array.from({ length: n }, (_, i) => characterProgress(p, i, n));
      const sorted = [...values].sort((a, b) => b - a);
      expect(values).toEqual(sorted);
    }
  });

  it('clamp01 tolerates NaN rather than propagating it into a transform', () => {
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

describe('resolveVariant — long-heading fallback', () => {
  it('keeps assemble for a normal display heading', () => {
    expect(resolveVariant('assemble', 45)).toBe('assemble');
  });

  it('falls back to ink past the long-heading threshold', () => {
    expect(resolveVariant('assemble', LONG_HEADING_CHARACTERS + 1)).toBe('ink');
  });

  it('never upgrades an explicit ink request', () => {
    expect(resolveVariant('ink', 10)).toBe('ink');
  });

  it('never downgrades the one explicit cinematic scene', () => {
    expect(resolveVariant('scene', LONG_HEADING_CHARACTERS + 30)).toBe('scene');
  });

  it('a real long heading trips the fallback', () => {
    const long = segmentHeading(
      'Career evidence that carries your licenses, training, and work history across every application you send out.',
    );
    expect(resolveVariant('assemble', long.characterCount)).toBe('ink');
  });
});
