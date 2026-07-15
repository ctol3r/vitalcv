'use client';

import * as React from 'react';

/**
 * KineticPhrase — the Anyscale "kinetic headline" pattern translated to Calm
 * Wave. A fixed prefix stays put while one trailing action phrase crossfades
 * upward to the next every few seconds, so the hero conveys the product's
 * breadth without a paragraph.
 *
 * Honesty + accessibility contract (per Chris's spec):
 *  - The complete static sentence is ALWAYS in the DOM (visually-hidden) so
 *    screen readers, no-JS, and the SSR guard render get the full meaning — the
 *    rotation is decoration layered on top, never the only source of truth.
 *  - Respects `prefers-reduced-motion`: no rotation, the static sentence shows.
 *  - Pauses while the tab is hidden and while the phrase is hovered/focused.
 *  - The animated visual is `aria-hidden`; a single-line slot prevents any
 *    vertical layout shift as phrase widths change.
 *  - No character-by-character typewriter — it reads as a thought changing.
 */
export function KineticPhrase({
  prefix,
  phrases,
  staticSentence,
  intervalMs = 3200,
  className,
  ...rest
}: {
  prefix: string;
  phrases: readonly string[];
  /** The full, honest sentence — the accessible + no-JS source of truth. */
  staticSentence: string;
  intervalMs?: number;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLParagraphElement>, 'children'>) {
  const [index, setIndex] = React.useState(0);
  const [animate, setAnimate] = React.useState(false);
  const paused = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || phrases.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setAnimate(true);
    const id = window.setInterval(() => {
      if (!paused.current && !document.hidden) {
        setIndex((i) => (i + 1) % phrases.length);
      }
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [phrases.length, intervalMs]);

  return (
    <p className={className} {...rest}>
      <span aria-hidden="true">
        {prefix}
        <span
          className="kinetic-phrase-slot"
          onMouseEnter={() => {
            paused.current = true;
          }}
          onMouseLeave={() => {
            paused.current = false;
          }}
        >
          {/* key drives the remount that plays the rise-in animation */}
          <span key={index} className={animate ? 'kinetic-phrase-in' : undefined}>
            {phrases[index]}
          </span>
        </span>
      </span>
      {/* Complete sentence for screen readers + no-JS — the real source of truth. */}
      <span className="sr-only">{staticSentence}</span>
    </p>
  );
}

export default KineticPhrase;
