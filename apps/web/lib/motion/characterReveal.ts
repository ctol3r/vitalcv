/**
 * characterReveal — the pure model behind ScrollScrubHeading (Motion M1).
 *
 * No React, no DOM, no framer-motion: segmentation and the scroll→character
 * mapping are plain functions so the contract is unit-testable and the
 * component stays a thin renderer.
 *
 * The grammar this encodes: the language is already there, faintly present, and
 * each letter resolves into certainty as the visitor scrolls —
 * unknown → checked → source-backed → accepted.
 */

export type HeadingWord = {
  /** The word as written, punctuation attached. */
  text: string;
  /** Grapheme-safe characters. Never re-split for layout. */
  characters: string[];
  /** Finishes in source-green rather than primary ink. */
  accent: boolean;
  /** Index of this word's first character in the heading-wide sequence. */
  characterOffset: number;
};

export type SegmentedHeading = {
  /** Words in reading order; `null` marks an intentional line break. */
  lines: HeadingWord[][];
  words: HeadingWord[];
  /** Total animated characters across the heading (spaces excluded). */
  characterCount: number;
};

/**
 * Grapheme-safe split. `'é'` composed of e + U+0301 is ONE character to a
 * reader, and `Array.from` (code points) would tear it in half — visibly
 * breaking accented names. Intl.Segmenter is the correct tool; Array.from is
 * the fallback where it is unavailable (still far better than split('')).
 */
export function toGraphemes(word: string): string[] {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(word), (entry) => entry.segment);
  }
  return Array.from(word);
}

/**
 * Split a heading into lines → words → graphemes.
 *
 * Words stay whole: the component renders each as an inline-block, so a line
 * can only ever break BETWEEN words. Letters never wrap alone.
 * `\n` is an intentional break and is preserved as a line boundary.
 */
export function segmentHeading(text: string, accentWords: readonly string[] = []): SegmentedHeading {
  const accentRanges = resolveAccentRanges(text, accentWords);

  const lines: HeadingWord[][] = [];
  const words: HeadingWord[] = [];
  let characterOffset = 0;
  let cursor = 0;

  for (const rawLine of text.split('\n')) {
    const line: HeadingWord[] = [];
    // Split on whitespace runs, keeping the words themselves intact.
    for (const token of rawLine.split(/(\s+)/)) {
      if (token.length === 0) continue;
      if (/^\s+$/.test(token)) {
        cursor += token.length;
        continue;
      }
      const start = text.indexOf(token, cursor);
      const wordStart = start === -1 ? cursor : start;
      const characters = toGraphemes(token);
      const word: HeadingWord = {
        text: token,
        characters,
        accent: accentRanges.some(
          ([from, to]) => wordStart >= from && wordStart + token.length <= to,
        ),
        characterOffset,
      };
      characterOffset += characters.length;
      cursor = wordStart + token.length;
      line.push(word);
      words.push(word);
    }
    lines.push(line);
  }

  return { lines, words, characterCount: characterOffset };
}

/** Locate accent phrases in the source text as [start, end) index ranges. */
function resolveAccentRanges(text: string, accentWords: readonly string[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const phrase of accentWords) {
    const trimmed = phrase.trim();
    if (!trimmed) continue;
    const index = text.indexOf(trimmed);
    if (index !== -1) ranges.push([index, index + trimmed.length]);
  }
  return ranges;
}

/**
 * The scroll window for character `i` of `n`.
 *
 * Characters start in sequence across the first 72% of section progress and
 * each resolves over an 18% window, so the last character completes at ~90% —
 * the final ~10% HOLDS the finished heading before it leaves the viewport.
 */
export function characterWindow(index: number, total: number): { start: number; end: number } {
  const start = (index / Math.max(1, total - 1)) * 0.72;
  return { start, end: Math.min(1, start + 0.18) };
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Local progress for character `i` given the section's global progress.
 * A pure function of scroll: forward assembles, backward reverses exactly.
 */
export function characterProgress(sectionProgress: number, index: number, total: number): number {
  const { start, end } = characterWindow(index, total);
  const span = end - start;
  if (span <= 0) return sectionProgress >= end ? 1 : 0;
  return clamp01((sectionProgress - start) / span);
}

/**
 * Long headings fall back to the quieter `ink` treatment: 80+ characters of
 * simultaneous transform is both visually noisy and the most expensive case on
 * mobile. Callers may also request `ink` explicitly.
 */
export const LONG_HEADING_CHARACTERS = 80;

export function resolveVariant(
  requested: 'assemble' | 'ink',
  characterCount: number,
): 'assemble' | 'ink' {
  if (requested === 'ink') return 'ink';
  return characterCount > LONG_HEADING_CHARACTERS ? 'ink' : 'assemble';
}
