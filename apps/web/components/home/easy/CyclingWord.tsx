'use client';

import { useEffect, useState } from 'react';

/**
 * CyclingWord — the payoff line's single-pass cycling word (amendment E,
 * Motion row).
 *
 * The server frame renders the SETTLED word ("application"), so reduced
 * motion, no-JS, and crawlers all read the finished sentence. After
 * hydration — and only outside reduced motion — the word runs one pass
 * through role → shift → hospital → state → application and settles. Nothing
 * loops; there is no replay. The 420ms step sits inside EC-29's 250–450ms
 * product-transformation band.
 *
 * The visible line is aria-hidden by its parent, which carries an sr-only
 * full sentence — assistive tech never hears the churn.
 */

const WORDS = ['role', 'shift', 'hospital', 'state', 'application'] as const;
const SETTLED = 'application';

export default function CyclingWord() {
  const [word, setWord] = useState<string>(SETTLED);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) return undefined;

    let index = 0;
    setWord(WORDS[0]);
    const timer = window.setInterval(() => {
      index += 1;
      if (index >= WORDS.length) {
        window.clearInterval(timer);
        setWord(SETTLED);
        return;
      }
      setWord(WORDS[index]);
    }, 420);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <span
      className="ezh-cycle"
      data-home-cycling-word={word === SETTLED ? 'settled' : 'cycling'}
    >
      {word}
    </span>
  );
}
