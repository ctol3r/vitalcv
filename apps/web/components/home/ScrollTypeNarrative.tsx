'use client';

import * as React from 'react';

/**
 * ScrollTypeNarrative — the hero narrative, driven by SCROLL PROGRESS (not a
 * timer), in the Palantir/Anyscale register Chris asked this wave to mirror:
 * the COMPLETE five-step sentence sits on the page in muted ink, and scrolling
 * the compact hero scrubs the fill through it word by word. Text ACCUMULATES —
 * a clause stays inked once revealed — and scrolling back up un-fills it in
 * real time.
 *
 * This deliberately replaces the phrase-replace model (#683), where each line
 * vanished when the next began: Chris's 2026-07-16 direction. #683's core
 * guarantees carry over into the new mapping:
 *  - Reveal is a pure function of scroll — forward fills, backward un-fills
 *    deterministically (no setInterval, no time dependency).
 *  - The first clause is the RESTING state: always inked, so a few pixels of
 *    scroll can never blank the line.
 *  - The full sentence is always laid out (pending words are dim, not absent),
 *    so the reveal cannot reflow layout — no reserved-cell tricks needed.
 *  - The COMPLETE sentence is also in the DOM as sr-only text — meaning never
 *    depends on scroll or JS; prefers-reduced-motion renders it plainly.
 *  - It is decoration beside the NPI form — it never gates or delays the input.
 */

export type NarrativeWord = { text: string; phraseIdx: number };

/**
 * Assemble the scrub-fill word list: prefix + the five clauses joined into the
 * exact static sentence ("…, …, …, …, and ….") so the inked text and the
 * accessible sentence can never drift apart.
 */
export function buildNarrativeWords(prefix: string, phrases: readonly string[]): NarrativeWord[] {
  const words: NarrativeWord[] = [];
  const lead = prefix.trim();
  if (lead) words.push({ text: lead, phraseIdx: 0 });
  phrases.forEach((phrase, phraseIdx) => {
    const last = phraseIdx === phrases.length - 1;
    const clause = `${last && phrases.length > 1 ? 'and ' : ''}${phrase}${last ? '.' : ','}`;
    for (const text of clause.split(' ')) words.push({ text, phraseIdx });
  });
  return words;
}

/**
 * Letter-level fill units (Chris, 2026-07-16: "letters of the words"). Words
 * stay the LAYOUT unit — rendered nowrap so lines break only at spaces — while
 * characters are the FILL unit the scrub advances through.
 */
export function buildNarrativeChars(prefix: string, phrases: readonly string[]): NarrativeWord[] {
  return buildNarrativeWords(prefix, phrases).flatMap((word) =>
    Array.from(word.text, (ch) => ({ text: ch, phraseIdx: word.phraseIdx })),
  );
}

/**
 * Pure scroll→reveal mapping (exported for unit tests).
 *
 * The fill is LINEAR across the whole runway — the scroll thumb is the typing
 * cursor, with no per-phrase dwells (dwells belong to the pin length, not the
 * mapping). `reveal` never drops below the first clause and completes slightly
 * before progress 1, leaving a natural beat at the end of the pin.
 */
export function narrativeStateAt(
  progress: number,
  words: readonly NarrativeWord[],
): { reveal: number; idx: number; complete: boolean } {
  const total = words.length;
  let minReveal = 0;
  while (minReveal < total && words[minReveal].phraseIdx === 0) minReveal += 1;
  const p = Math.min(1, Math.max(0, progress));
  const reveal = Math.max(minReveal, Math.min(total, Math.round(p * total)));
  const idx = words[Math.max(0, reveal - 1)].phraseIdx;
  return { reveal, idx, complete: reveal === total };
}

// Pending words stay legible as a muted skeleton (the Palantir cue that more
// text is coming), and the fill snaps to scroll — a long fade here would lag
// the scrub, so the transition is just enough to soften the edge.
const PENDING_OPACITY = 0.25;
const FILL_TRANSITION = 'opacity 140ms ease-out';

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
    () => buildNarrativeWords(prefix, phrases),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phraseKey],
  );

  const chars = React.useMemo(
    () => buildNarrativeChars(prefix, phrases),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phraseKey],
  );

  // Before hydration every letter is inked, so no-JS visitors read the whole
  // sentence; the first scroll measurement takes over from there.
  const [reveal, setReveal] = React.useState(chars.length);
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
      // The hero no longer owns a pinned runway. Complete the decorative fill
      // within a short, visibly active portion of the opening viewport so the
      // NPI action and the next section are never delayed by motion.
      const revealDistance = Math.max(180, Math.min(vh * 0.32, container.offsetHeight * 0.45));
      const revealStart = Math.max(0, containerTop - vh * 0.16);
      const p = (window.scrollY - revealStart) / Math.max(1, revealDistance);
      setReveal(narrativeStateAt(p, chars).reveal);
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
  }, [scrollContainerId, chars]);

  const total = chars.length;
  const idx = chars[Math.max(0, Math.min(total, reveal) - 1)]?.phraseIdx ?? 0;
  const complete = reveal >= total;

  // Word wrappers (nowrap) keep line-breaking at spaces while LETTERS carry
  // the fill; each word knows the char offset where its letters begin.
  let charOffset = 0;
  const wordSpans = words.map((word) => {
    const start = charOffset;
    charOffset += word.text.length;
    return { word, start };
  });

  return (
    // data-narrative-state / -complete expose the scroll-derived fill to e2e,
    // so "fills on screen, accumulating" is asserted rather than assumed.
    <p
      className={className}
      data-narrative-state={reduce ? 'reduced' : `${idx}:${reveal}`}
      data-narrative-complete={!reduce && complete ? '' : undefined}
      {...rest}
    >
      {reduce ? (
        <span aria-hidden="true" className="block">{staticSentence}</span>
      ) : (
        <span aria-hidden="true" data-narrative-words="" className="block">
          {wordSpans.map(({ word, start }, i) => (
            <React.Fragment key={i}>
              {i > 0 ? ' ' : ''}
              <span style={{ whiteSpace: 'nowrap' }}>
                {Array.from(word.text, (ch, j) => (
                  <span
                    key={j}
                    data-ch=""
                    style={{
                      opacity: start + j < reveal ? 1 : PENDING_OPACITY,
                      transition: FILL_TRANSITION,
                    }}
                  >
                    {ch}
                  </span>
                ))}
              </span>
            </React.Fragment>
          ))}
        </span>
      )}
      {/* Sequence progress — which of the five steps the fill has reached. */}
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
