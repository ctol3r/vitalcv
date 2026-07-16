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

/**
 * Pure scroll→narrative mapping (exported for unit tests).
 *
 * Rules (post-audit polish):
 *  - Phrase 0 is the RESTING phrase: fully shown for its entire segment, so a
 *    few pixels of scroll can never wipe the line and retype it (the old
 *    `p < 0.005` special case collapsed to 0 words at p≈0.006).
 *  - Later phrases type over the FIRST HALF of their segment and dwell fully
 *    typed for the second half — every phrase gets a readable hold.
 *  - A typing phrase never renders fewer than 1 word (no blank frames).
 *  - Reversing scroll runs the same pure function backwards, so it untypes
 *    deterministically.
 */
export function narrativeStateAt(
  progress: number,
  phrases: readonly string[],
): { idx: number; shown: number } {
  const p = Math.min(1, Math.max(0, progress));
  const seg = p * phrases.length;
  const idx = Math.min(phrases.length - 1, Math.floor(seg));
  const wordCount = phrases[idx].split(' ').length;
  if (idx === 0) return { idx, shown: wordCount };
  const intra = seg - idx;
  const shown = Math.max(1, Math.round(Math.min(1, intra / 0.5) * wordCount));
  return { idx, shown };
}

export function ScrollTypeNarrative({
  prefix,
  phrases,
  staticSentence,
  scrollContainerId,
  className,
  ...rest
}: {
  prefix: string;
  phrases: readonly string[];
  /** The full, honest sentence — accessible + no-JS source of truth. */
  staticSentence: string;
  /** Section whose scroll progress drives the reveal. */
  scrollContainerId: string;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLParagraphElement>, 'children'>) {
  const [idx, setIdx] = React.useState(0);
  // words revealed in the current phrase; -1 means "show the whole phrase"
  // (the resting state at scroll top and under reduced motion).
  const [words, setWords] = React.useState(-1);
  const [reduce, setReduce] = React.useState(false);

  const phraseKey = phrases.join('|');

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReduce(media.matches);
    syncMotion();
    media.addEventListener('change', syncMotion);
    let raf = 0;
    const update = () => {
      raf = 0;
      if (media.matches) return;
      const container = document.getElementById(scrollContainerId);
      if (!container) return;
      const vh = window.innerHeight || 1;
      const containerTop = container.getBoundingClientRect().top + window.scrollY;
      // Reveal distance depends on whether the container PINS the narrative.
      //
      // Unpinned (mobile / reduced-motion sizing), the line scrolls away with
      // the page, so the sequence has to be quick: 0.72vh.
      //
      // Pinned (desktop .hero-pin), the line is held at a fixed viewport
      // position for `pinDistance`, so the reveal can use that whole runway and
      // still finish on screen — measured on the pre-pin build, phrases 3-5 all
      // played below the fold because 0.72vh outlives the line's exit at
      // ~0.58vh. Complete at 96% of the pin: the earlier 85% left a ~0.18vh
      // dead-scroll dwell that read as empty page.
      const pinDistance = container.offsetHeight - vh;
      const revealDistance = pinDistance > vh * 0.4 ? pinDistance * 0.96 : vh * 0.72;
      const p = (window.scrollY - containerTop) / revealDistance;
      const next = narrativeStateAt(p, phrases);
      setIdx(next.idx);
      setWords(next.shown);
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
      media.removeEventListener('change', syncMotion);
      if (raf) cancelAnimationFrame(raf);
    };
  // phraseKey deliberately keeps inline array literals from re-binding the
  // scroll listener on every parent render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phraseKey, scrollContainerId]);

  const current = phrases[idx] ?? phrases[0];
  const wordArr = current.split(' ');

  return (
    // data-narrative-state exposes the scroll-derived reveal to e2e, so the
    // "types while on screen" guarantee is asserted rather than assumed.
    <p className={className} data-narrative-state={reduce ? 'reduced' : `${idx}:${words}`} {...rest}>
      {/* Reserved grid cell: the longest phrase holds width/height while the
          active phrase is painted in the same cell, so typing cannot reflow. */}
      <span aria-hidden="true" className="grid min-h-[3.4rem] sm:min-h-[2.6rem]">
        {reduce ? (
          <span className="col-start-1 row-start-1">{staticSentence}</span>
        ) : (
          <>
            <span className="invisible col-start-1 row-start-1">
              {prefix}{phrases.reduce((longest, phrase) => phrase.length > longest.length ? phrase : longest, '')}
            </span>
            <span className="col-start-1 row-start-1">
              {prefix}
              {wordArr.map((w, i) => (
              <span
                key={`${idx}-${i}`}
                style={{
                  opacity: words < 0 || i < words ? 1 : 0,
                  transition: 'opacity 360ms cubic-bezier(0.25,0.6,0.3,1)',
                }}
              >
                {w}
                {i < wordArr.length - 1 ? ' ' : ''}
              </span>
              ))}
            </span>
          </>
        )}
      </span>
      {/* Sequence progress — which of the five steps is active. */}
      <span aria-hidden="true" className={reduce ? 'hidden' : 'mt-2 flex items-center gap-1.5'}>
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
