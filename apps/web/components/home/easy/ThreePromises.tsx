'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * ThreePromises — the whole bottom-half story in three warm cards.
 *
 * Founder directive (2026-08-16, amendment E.1): "simple, practical, easy,
 * positivity, and fun. not: boring, text-heavy, confusing, complicated."
 * The seven-step mobility band, the standing-watch timeline, the attribution
 * ledger, and the five-item FAQ said true things a visitor did not need on a
 * homepage. These three cards say what the visitor gets, once each, and stop.
 *
 * Truth boundaries the copy holds without restating them: reuse is a claim
 * about the RECORD persisting (not about integrated apply inventory); the
 * watch claim stays at what the product does (tracks renewal dates); consent
 * is stated as the rule it is. No state vocabulary, no process diagrams.
 * The glyphs are decorative pictograms (aria-hidden), not scenes — they
 * depict no source, count, person, or result, so they carry no self-label.
 *
 * MOTION (2026-08-16, founder-selected reference study). The three cards
 * arrive in sequence as the section is reached — the "accumulation" grammar:
 * three things gathering into one record, which is what the section says.
 * The reference expresses accumulation by PINNING cards as you scroll; that
 * mechanic was measured against this content and does not transfer — the
 * three cards fit inside one viewport at every supported width (767px stacked
 * against an 844px phone viewport), so pinning has no scroll distance to work
 * in, and buying that distance would pad the page amendment E.1 cut in half.
 *
 * The arrival follows this island's own entrance contract (WorkSurface's
 * static → armed → run → done), not the platform `Reveal` primitive, whose
 * animation lives in the PARKED Calm Wave stylesheet — importing a parked era
 * into the amendment E register is exactly what PARKED_VISUAL_ERAS forbids.
 * The server frame renders the finished state; script only ARMS the
 * enhancement; reduced motion never arms it; a safety timeout strips the
 * machinery so a transition that never paints can strand nothing.
 */
type Stage = 'static' | 'armed' | 'run' | 'done';

export default function ThreePromises() {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<Stage>('static');

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Reduced motion is a composition, not a fallback (XS-7/EC-25): the
    // finished row is simply present, and nothing is ever hidden first.
    if (reducedMotion.matches) return undefined;
    // Without IntersectionObserver, never arm — the completed frame stands.
    if (typeof IntersectionObserver === 'undefined') return undefined;

    let first = 0;
    let second = 0;
    let settle = 0;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setStage('armed');
        first = window.requestAnimationFrame(() => {
          second = window.requestAnimationFrame(() => setStage('run'));
        });
        // Safety: whatever the transitions did, the finished frame stands.
        settle = window.setTimeout(() => setStage('done'), 2400);
      },
      { threshold: 0.2, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(grid);

    const stopForReducedMotion = () => {
      if (reducedMotion.matches) setStage('static');
    };
    reducedMotion.addEventListener('change', stopForReducedMotion);

    return () => {
      io.disconnect();
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
      window.clearTimeout(settle);
      reducedMotion.removeEventListener('change', stopForReducedMotion);
    };
  }, []);

  return (
    <section className="ezh-promises" data-header-theme="light" aria-labelledby="ezh-promises-h">
      <div className="ezh-wrap">
        <div className="ezh-sec-head">
          <span className="ezh-k">The short version</span>
          <h2 id="ezh-promises-h">Three things. That&rsquo;s the whole idea.</h2>
        </div>

        <div className="ezh-promise-grid" ref={gridRef} data-motion={stage}>
          <article className="ezh-promise">
            <svg className="ezh-promise-glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <rect x="9" y="7" width="22" height="28" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
              <path
                d="M35 15 a10 10 0 0 1 0 20 h-4"
                fill="none"
                stroke="var(--vt-home-e-action)"
                strokeWidth="2.5"
              />
              <path d="M34 31 L30 35 L34 39" fill="none" stroke="var(--vt-home-e-action)" strokeWidth="2.5" />
            </svg>
            <h3>Build it once. Take it everywhere.</h3>
            <p>
              Your record stays yours and moves with you. The next application starts from
              everything you&rsquo;ve already built &mdash; not from a blank page.
            </p>
          </article>

          <article className="ezh-promise">
            <svg className="ezh-promise-glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <rect x="7" y="17" width="34" height="14" rx="7" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="34" cy="24" r="5" fill="var(--vt-home-e-action)" />
            </svg>
            <h3>You say what gets shared.</h3>
            <p>
              Nothing leaves your record until you say so. That&rsquo;s the whole rule &mdash;
              there is no fine print under it.
            </p>
          </article>

          <article className="ezh-promise">
            <svg className="ezh-promise-glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M24 15 v9 l6 4" fill="none" stroke="var(--vt-home-e-action)" strokeWidth="2.5" />
            </svg>
            <h3>We keep watch, so you don&rsquo;t.</h3>
            <p>
              License renewals, expiring paperwork &mdash; VitalCV tracks the dates and tells you
              when something actually needs you. Most weeks, nothing does.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
