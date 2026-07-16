'use client';

import * as React from 'react';

/**
 * ScrollTypeNarrative — the hero narrative, driven by SCROLL PROGRESS (not a
 * timer). The five-step sequence assembles into one sentence, word by word, as
 * the visitor scrolls; scrolling back up un-types it deterministically.
 *
 * Contract (per Chris's Motion Wave spec):
 *  - Reveal is a pure function of window scroll (no setInterval, no time
 *    dependency), so forward scroll types and backward scroll reverses.
 *  - Words ACCUMULATE — a clause stays readable once typed — and the full
 *    sentence's space is reserved up front, so typing cannot reflow layout.
 *  - Inside the pinned desktop hero the reveal completes at ~85% of the pin
 *    distance, so every clause types while the line is on screen. (The earlier
 *    phrase-replace version typed steps 3–5 after the line had left the
 *    viewport — measured at 1440×1000.)
 *  - When the hero is not pinned (mobile / reduced motion fallback sizing) the
 *    reveal completes within ~45% of one viewport of scroll, before the line
 *    can leave the screen.
 *  - The COMPLETE static sentence is always in the DOM (sr-only) — meaning
 *    never depends on scroll or JS; prefers-reduced-motion renders it plainly.
 *  - It is decoration beside the NPI form — it never gates or delays the input.
 */

type Word = { text: string; phraseIdx: number };

function buildWords(prefix: string, phrases: readonly string[]): Word[] {
  const words: Word[] = [];
  const lead = prefix.trim();
  if (lead) words.push({ text: lead, phraseIdx: 0 });
  phrases.forEach((phrase, phraseIdx) => {
    const last = phraseIdx === phrases.length - 1;
    const clause = `${last && phrases.length > 1 ? 'and ' : ''}${phrase}${last ? '.' : ','}`;
    for (const text of clause.split(' ')) words.push({ text, phraseIdx });
  });
  return words;
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
  const phraseKey = `${prefix}|${phrases.join('|')}`;
  const words = React.useMemo(
    () => buildWords(prefix, phrases),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phraseKey],
  );
  // The first clause is the resting state — the line is never blank.
  const minReveal = React.useMemo(
    () => words.filter((word) => word.phraseIdx === 0).length,
    [words],
  );

  // Before hydration every word is revealed, so no-JS visitors read the whole
  // sentence; the first scroll measurement takes over from there.
  const [reveal, setReveal] = React.useState(words.length);
  const [reduce, setReduce] = React.useState(false);

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
      // Pinned hero (container much taller than the viewport): finish typing at
      // ~85% of the pin so the sequence completes on screen, then hold.
      // Unpinned: finish within half a viewport, before the line scrolls away.
      const pinDistance = container.offsetHeight - vh;
      const revealDistance = pinDistance > vh * 0.4 ? pinDistance * 0.85 : vh * 0.45;
      const p = Math.min(1, Math.max(0, (window.scrollY - containerTop) / Math.max(1, revealDistance)));
      setReveal(Math.max(minReveal, Math.round(p * words.length)));
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
  }, [minReveal, scrollContainerId, words]);

  const sentence = words.map((word) => word.text).join(' ');
  const activePhrase = words[Math.min(words.length, reveal) - 1]?.phraseIdx ?? 0;

  return (
    <p className={className} data-typed-words={reduce ? words.length : reveal} {...rest}>
      {/* Reserved grid cell: the complete sentence holds its own space while the
          revealed words are painted in the same cell, so typing cannot reflow. */}
      <span aria-hidden="true" className="grid">
        {reduce ? (
          <span className="col-start-1 row-start-1">{staticSentence}</span>
        ) : (
          <>
          <span className="invisible col-start-1 row-start-1">{sentence}</span>
          <span className="col-start-1 row-start-1">
            {words.map((word, i) => (
              <span
                key={i}
                style={{
                  opacity: i < reveal ? 1 : 0,
                  transition: 'opacity 180ms cubic-bezier(0.2,0.7,0.2,1)',
                }}
              >
                {word.text}
                {i < words.length - 1 ? ' ' : ''}
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
              width: i === activePhrase ? 18 : 6,
              backgroundColor: i <= activePhrase ? 'var(--vt-text-primary)' : 'var(--vt-border)',
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
