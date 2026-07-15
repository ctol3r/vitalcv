'use client';

import * as React from 'react';

/**
 * ScrollTypeNarrative — the hero narrative, driven by SCROLL PROGRESS (not a
 * timer). As the visitor scrolls the first screen, the sequence types out word
 * by word; scrolling back up reverses it cleanly. Replaces the interval-driven
 * KineticPhrase.
 *
 * Contract (per Chris's Motion Wave spec):
 *  - Reveal is a pure function of window scroll, so forward types / backward
 *    untypes deterministically (no setInterval, no time dependency).
 *  - Word-level reveal via opacity on the full current phrase → NO layout shift
 *    (a reserved min-height holds the line; words fade in place).
 *  - The COMPLETE static sentence is always in the DOM (sr-only) — meaning never
 *    depends on scroll or JS; no-JS and screen readers get the whole thing.
 *  - prefers-reduced-motion → the full sentence, no scroll dependency.
 *  - It is decoration beside the NPI form — it never gates or delays the input.
 */

// Fraction of a viewport of scrolling over which the whole sequence types out.
const REVEAL_FRACTION = 0.85;

export function ScrollTypeNarrative({
  prefix,
  phrases,
  staticSentence,
  className,
  ...rest
}: {
  prefix: string;
  phrases: readonly string[];
  /** The full, honest sentence — accessible + no-JS source of truth. */
  staticSentence: string;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLParagraphElement>, 'children'>) {
  const [idx, setIdx] = React.useState(0);
  // words revealed in the current phrase; -1 means "show the whole phrase"
  // (the resting state at scroll top and under reduced motion).
  const [words, setWords] = React.useState(-1);
  const [reduce, setReduce] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduce(true);
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight || 1;
      const p = Math.min(1, Math.max(0, window.scrollY / (vh * REVEAL_FRACTION)));
      const seg = p * phrases.length;
      const i = Math.min(phrases.length - 1, Math.floor(seg));
      const intra = seg - i;
      const wordCount = phrases[i].split(' ').length;
      // At the very top, rest on the first phrase fully typed (never blank);
      // otherwise type the active phrase over the first ~60% of its segment.
      const shown =
        window.scrollY < 2 ? phrases[0].split(' ').length : Math.round(Math.min(1, intra / 0.6) * wordCount);
      setIdx(i);
      setWords(shown);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [phrases]);

  const current = phrases[idx] ?? phrases[0];
  const wordArr = current.split(' ');

  return (
    <p className={className} {...rest}>
      {/* Reserved-height line: words fade in place, so the phrase never reflows. */}
      <span aria-hidden="true" className="block min-h-[3.4rem] sm:min-h-[2.6rem]">
        {prefix}
        {reduce
          ? current
          : wordArr.map((w, i) => (
              <span
                key={`${idx}-${i}`}
                style={{
                  opacity: words < 0 || i < words ? 1 : 0,
                  transition: 'opacity 200ms cubic-bezier(0.2,0.7,0.2,1)',
                }}
              >
                {w}
                {i < wordArr.length - 1 ? ' ' : ''}
              </span>
            ))}
      </span>
      {/* Sequence progress — which of the five steps is active. */}
      <span aria-hidden="true" className="mt-2 flex items-center gap-1.5">
        {phrases.map((_, i) => (
          <span
            key={i}
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: i === idx ? 18 : 6,
              backgroundColor: i <= idx ? 'var(--vt-text-primary)' : 'var(--vt-border)',
            }}
          />
        ))}
      </span>
      {/* Complete sentence for screen readers + no-JS — the real source of truth. */}
      <span className="sr-only">{staticSentence}</span>
    </p>
  );
}

export default ScrollTypeNarrative;
