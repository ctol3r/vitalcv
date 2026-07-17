'use client';

import * as React from 'react';

/**
 * ScrollTypeNarrative — the hero narrative, TYPED character by character in the
 * Palantir register (Chris, 2026-07-17: "types out every single character").
 *
 * This deliberately replaces the scroll-scrubbed fill (which itself replaced
 * #683's phrase-replace model): the full five-step sentence sits on the page as
 * a muted skeleton, and once the hero is on screen the letters ink in TIME, in
 * reading order, behind a block caret. Guarantees carried forward:
 *  - The reveal is monotonic — a letter never un-inks.
 *  - The full sentence is always laid out (pending letters are dim, not
 *    absent), so typing cannot reflow layout.
 *  - The COMPLETE sentence is in the DOM as sr-only text — meaning never
 *    depends on JS or timing; prefers-reduced-motion renders it plainly.
 *  - It is decoration beside the NPI form — it never gates or delays the input.
 */

export type NarrativeWord = { text: string; phraseIdx: number };

/**
 * Assemble the word list: prefix + the five clauses joined into the exact
 * static sentence ("…, …, …, …, and ….") so the inked text and the accessible
 * sentence can never drift apart.
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
 * Letter-level units. Words stay the LAYOUT unit — rendered nowrap so lines
 * break only at spaces — while characters are the unit the caret advances
 * through.
 */
export function buildNarrativeChars(prefix: string, phrases: readonly string[]): NarrativeWord[] {
  return buildNarrativeWords(prefix, phrases).flatMap((word) =>
    Array.from(word.text, (ch) => ({ text: ch, phraseIdx: word.phraseIdx })),
  );
}

/** Typing cadence: fast enough that a ~130-char sentence lands in ~1.8s. */
export const NARRATIVE_CHAR_MS = 14;

/**
 * Pure time→reveal mapping (exported for unit tests): 0 before `delayMs`, then
 * one character per NARRATIVE_CHAR_MS, clamped at the total. Monotonic in
 * elapsed time by construction.
 */
export function typedNarrativeState(
  elapsedMs: number,
  chars: readonly NarrativeWord[],
  delayMs = 0,
): { reveal: number; idx: number; complete: boolean } {
  const total = chars.length;
  const reveal =
    elapsedMs <= delayMs ? 0 : Math.min(total, Math.floor((elapsedMs - delayMs) / NARRATIVE_CHAR_MS));
  const idx = chars[Math.max(0, reveal - 1)]?.phraseIdx ?? 0;
  return { reveal, idx, complete: reveal === total };
}

// Pending letters stay legible as a muted skeleton (the Palantir cue that more
// text is coming); typed letters snap to full ink with just enough transition
// to soften the edge.
const PENDING_OPACITY = 0.25;
const FILL_TRANSITION = 'opacity 120ms ease-out';

export function ScrollTypeNarrative({
  prefix,
  phrases,
  staticSentence,
  startDelayMs = 0,
  className,
  ...rest
}: {
  prefix: string;
  phrases: readonly string[];
  /** The full, honest sentence — accessible + no-JS source of truth. */
  staticSentence: string;
  /** Ms after entering the viewport before typing begins (lets the H1 finish). */
  startDelayMs?: number;
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
  // sentence; the typing effect takes over from there.
  const [reveal, setReveal] = React.useState(chars.length);
  const [reduce, setReduce] = React.useState(false);
  const hostRef = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReduce(media.matches);
    syncMotion();
    if (media.matches) {
      media.addEventListener('change', syncMotion);
      return () => media.removeEventListener('change', syncMotion);
    }
    media.addEventListener('change', syncMotion);

    let raf = 0;
    let started = -1;
    const total = chars.length;
    const tick = (now: number) => {
      if (started < 0) started = now;
      const next = typedNarrativeState(now - started, chars, startDelayMs).reveal;
      setReveal((prev) => (prev === next ? prev : next));
      if (next < total) raf = requestAnimationFrame(tick);
    };

    // Arm on viewport entry, then type in time. Reveal drops to 0 only once
    // JS owns the animation — the server HTML always carries the full ink.
    setReveal(0);
    const host = hostRef.current;
    let io: IntersectionObserver | null = null;
    if (host && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            io?.disconnect();
            raf = requestAnimationFrame(tick);
          }
        },
        { threshold: 0.3 },
      );
      io.observe(host);
    } else {
      raf = requestAnimationFrame(tick);
    }
    return () => {
      media.removeEventListener('change', syncMotion);
      io?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [chars, startDelayMs]);

  const total = chars.length;
  const idx = chars[Math.max(0, Math.min(total, reveal) - 1)]?.phraseIdx ?? 0;
  const complete = reveal >= total;

  // Word wrappers (nowrap) keep line-breaking at spaces while LETTERS carry
  // the ink; each word knows the char offset where its letters begin.
  let charOffset = 0;
  const wordSpans = words.map((word) => {
    const start = charOffset;
    charOffset += word.text.length;
    return { word, start };
  });

  return (
    // data-narrative-state / -complete expose the typed reveal to e2e, so
    // "types on screen, accumulating" is asserted rather than assumed.
    <p
      ref={hostRef}
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
                  <React.Fragment key={j}>
                    <span
                      data-ch=""
                      style={{
                        opacity: start + j < reveal ? 1 : PENDING_OPACITY,
                        transition: FILL_TRANSITION,
                      }}
                    >
                      {ch}
                    </span>
                    {start + j === reveal - 1 && !complete ? (
                      <span aria-hidden="true" className="type-caret" data-type-caret="" />
                    ) : null}
                  </React.Fragment>
                ))}
              </span>
            </React.Fragment>
          ))}
        </span>
      )}
      {/* Sequence progress — which of the five steps the caret has reached. */}
      <span aria-hidden="true" className={reduce ? 'hidden' : 'mt-2 flex items-center gap-1.5'}>
        {phrases.map((_, i) => (
          <span
            key={i}
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: i === idx ? 18 : 6,
              // Reached clauses fill in source-green; the active clause is the
              // deeper accent — the two primary hues read together on the rail.
              backgroundColor:
                i === idx
                  ? 'var(--accent)'
                  : i < idx
                    ? 'var(--vt-accent-emerald)'
                    : 'var(--vt-border)',
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
