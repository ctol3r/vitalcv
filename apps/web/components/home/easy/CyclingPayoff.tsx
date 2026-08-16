'use client';

/**
 * CyclingPayoff — the hero payoff line of the Direction A register
 * (constitution amendment E, Motion row).
 *
 * "One profile. Every {role · shift · hospital · state · application}."
 *
 * The cycling word is the one thing the founder singled out of Direction C in
 * round 2 — *"for sure i like how the last w[o]rd in the header changes to
 * different words"* — folded into A. It is also the only motion on the hero,
 * so it is bounded hard:
 *
 *   SINGLE PASS. It runs the list once and settles on "application". Nothing
 *   loops. A looping word is decoration competing with the H1 for attention
 *   for as long as the visitor stays, which is exactly the "flashy one-off"
 *   the founder's 2026-08-15 motion direction rejects.
 *
 *   THE SETTLED WORD IS THE SERVER FRAME. SSR renders "application". No-JS,
 *   pre-hydration, and `prefers-reduced-motion` all show that same settled
 *   word — the animation is an enhancement layered on a complete sentence,
 *   never the thing that produces it (EC-25–29: reduced motion is a
 *   composition, not a fallback).
 *
 *   MEANING NEVER RIDES ON THE MOTION (EC-4). The full list is always in the
 *   accessible tree as one sr-only sentence, so a visitor who never sees a
 *   frame of it still gets the whole claim.
 *
 * Per-word timings sit in EC-29's 150–250ms state-transition band; the cycle
 * completes in well under a second and then the component is inert.
 */

import { useEffect, useRef, useState } from 'react';

/** The settled word is LAST. Everything else is a pass-through. */
const WORDS = ['role', 'shift', 'hospital', 'state', 'application'] as const;
const SETTLED = WORDS[WORDS.length - 1];

const STEP_MS = 300;

export default function CyclingPayoff() {
  // Index starts at the settled word so the first client paint matches the
  // server frame exactly — no flash of a different word before the cycle
  // starts, and no hydration mismatch.
  const [index, setIndex] = useState(WORDS.length - 1);
  const [cycling, setCycling] = useState(false);
  const played = useRef(false);

  useEffect(() => {
    if (played.current) return;
    played.current = true;

    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    setCycling(true);
    setIndex(0);

    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      if (step >= WORDS.length - 1) {
        window.clearInterval(timer);
        setIndex(WORDS.length - 1);
        setCycling(false);
        return;
      }
      setIndex(step);
    }, STEP_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <p className="ezh-payoff">
      <span aria-hidden="true">
        One profile. Every{' '}
        <span className="ezh-payoff-cycle" data-cycling={cycling ? '' : undefined}>
          {WORDS[index]}
        </span>
        .
      </span>
      {/*
        The accessible sentence carries the whole list, not just whichever word
        is on screen at the moment a screen reader reaches it. `aria-hidden` on
        the visual span keeps the two from being read twice.
      */}
      <span className="ezh-sr">
        One profile. Every {WORDS.slice(0, -1).join(', ')}, and every {SETTLED}.
      </span>
    </p>
  );
}
