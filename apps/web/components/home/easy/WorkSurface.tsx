'use client';

import { useEffect, useState } from 'react';

/**
 * The homepage's self-labelled illustration. The content is fully present in
 * SSR; JavaScript adds the assembly treatment only after hydration so a
 * delayed script can never leave the record blank.
 */
export default function WorkSurface() {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) return undefined;

    const frame = window.requestAnimationFrame(() => setAnimate(true));
    const stopForReducedMotion = () => {
      if (reducedMotion.matches) setAnimate(false);
    };
    reducedMotion.addEventListener('change', stopForReducedMotion);

    return () => {
      window.cancelAnimationFrame(frame);
      reducedMotion.removeEventListener('change', stopForReducedMotion);
    };
  }, []);

  return (
    <figure
      id="how-it-works"
      className={`ezh-surface ezh-watch-record${animate ? ' anim' : ''}`}
      data-home-work-surface=""
      data-motion={animate ? 'assembling' : 'static'}
      aria-label="Illustration of a clinician-controlled career record, with source states shown openly."
    >
      <span className="ezh-folio-depth depth-back" aria-hidden="true" />
      <span className="ezh-folio-depth depth-mid" aria-hidden="true" />
      <div className="ezh-folio-paper">
        <span className="ezh-folio-binding" aria-hidden="true" />
        <span className="ezh-folio-tab tab-record" aria-hidden="true">Record</span>
        <span className="ezh-folio-tab tab-share" aria-hidden="true">Share</span>

        <div className="ezh-watch-head">
          <div>
            <p className="ezh-watch-kicker">CV Wallet</p>
            <p className="ezh-watch-title">Your career record, source by source.</p>
          </div>
          <span className="ezh-watch-illustrative">Illustrative</span>
        </div>

        <ol className="ezh-watch-rows">
          <li className="ezh-watch-row is-source">
            <span className="ezh-watch-index" aria-hidden="true">1</span>
            <span className="ezh-watch-row-copy">
              <strong>Identity</strong>
              <small>NPPES</small>
            </span>
            <span className="ezh-watch-state">Source-backed</span>
          </li>
          <li className="ezh-watch-row">
            <span className="ezh-watch-index" aria-hidden="true">2</span>
            <span className="ezh-watch-row-copy">
              <strong>Practice history</strong>
              <small>You control what you add</small>
            </span>
            <span className="ezh-watch-state">Your record</span>
          </li>
          <li className="ezh-watch-row is-attention">
            <span className="ezh-watch-index" aria-hidden="true">3</span>
            <span className="ezh-watch-row-copy">
              <strong>License record</strong>
              <small>State board</small>
            </span>
            <span className="ezh-watch-state">Access required</span>
          </li>
          <li className="ezh-watch-row">
            <span className="ezh-watch-index" aria-hidden="true">4</span>
            <span className="ezh-watch-row-copy">
              <strong>Career evidence</strong>
              <small>Selected by you</small>
            </span>
            <span className="ezh-watch-state">Needs your review</span>
          </li>
        </ol>

        <div className="ezh-watch-choice">
          <span className="ezh-watch-choice-mark" aria-hidden="true" />
          <div>
            <p>Choose what you share</p>
            <span>Your employer receives the exact record you approve.</span>
          </div>
        </div>

        <figcaption className="ezh-rm-legend">
          Illustration — not a live result. It names source-backed facts, open work, and access
          limits without implying an employer decision.
        </figcaption>
      </div>
    </figure>
  );
}
