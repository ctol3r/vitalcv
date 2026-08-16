'use client';

import { useEffect, useState } from 'react';

/**
 * HeroFolio — the v4 hero figure (amendment F): source readings arrive as
 * ruled tiles into a record folio the clinician owns.
 *
 * Evidence-geometry per the founder's v4 illustration kit, corrected to
 * standing law before anything ships:
 *
 *  - The NPI is MASKED (`NPI ··· ··· ····`) — the founder file carried
 *    1043002765, a well-formed NPI that may name a real person.
 *  - The four tiles are REAL registry lanes in states the product actually
 *    produces: NPPES (read live), OIG/LEIE (monthly snapshot), state
 *    licensure (access-gated), employment history (not checked). The founder
 *    file depicted ABIM/ABMS returning, a California licence number, an
 *    Oregon expiry and UCSF privileges — none of which the product can read
 *    or has read (EC-25.2).
 *  - Values are blank bars; the real ones belong to the viewer.
 *
 * Motion is SINGLE-SHOT (the founder file defaulted ambient; EC-29's no-loop
 * rule holds — recorded as a deviation in amendment F): the cadence line
 * draws once, the tiles arrive once, then a settle timeout strips the
 * machinery so nothing can strand hidden. Reduced motion never arms; the
 * server frame is the complete composition.
 */

const TRANSCRIPT =
  'Sources read on their own cadence and return what they hold into one record the clinician owns. The NPPES registry reads live; the OIG exclusion file is a monthly snapshot; state licensure is access-gated; employment history stays not checked until an issuer attests.';

type Stage = 'static' | 'armed' | 'run' | 'done';

export default function HeroFolio() {
  const [stage, setStage] = useState<Stage>('static');

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) return undefined;

    setStage('armed');
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => setStage('run'));
    });
    const settle = window.setTimeout(() => setStage('done'), 2200);
    const stopForReducedMotion = () => {
      if (reducedMotion.matches) setStage('static');
    };
    reducedMotion.addEventListener('change', stopForReducedMotion);

    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
      window.clearTimeout(settle);
      reducedMotion.removeEventListener('change', stopForReducedMotion);
    };
  }, []);

  return (
    <figure
      id="how-it-works"
      className="ezh-fig ezh-fig-hero"
      data-home-work-surface=""
      data-home-figure="hero-folio"
      data-visual-material="drawn-ink"
      data-motion={stage}
      aria-label="Drawn illustration: named public sources return readings into a record folio the clinician owns; one row stays access-gated and one stays not checked."
    >
      <div className="ezh-fig-art" aria-hidden="true">
        {/* wide variant — desktop and tablet */}
        <svg className="ezh-fig-wide" viewBox="0 0 460 396" focusable="false">
          <path
            className="ezh-f-ecg"
            style={{ ['--ezh-len' as never]: '580' }}
            d="M8 40 H96 l7-16 5 30 6-26 6 12 H192 l8-20 5 28 5-16 H452"
          />
          <text className="ezh-f-lbl" x="8" y="22">Sources read on their own cadence</text>

          <rect className="ezh-f-field" x="24" y="58" width="132" height="24" rx="3" />
          <text className="ezh-f-lbl" x="36" y="74">Your record</text>

          <rect className="ezh-f-paper" x="24" y="82" width="412" height="300" rx="3" />
          <text className="ezh-f-data" x="44" y="108">NPI ··· ··· ····</text>
          <text className="ezh-f-mut" x="416" y="108" textAnchor="end">yours for life</text>
          <path className="ezh-f-hair" d="M44 120 H416" />

          <g className="ezh-f-arr" style={{ ['--ezh-d' as never]: '.25s' }}>
            <rect className="ezh-f-tile" x="44" y="132" width="372" height="52" rx="3" />
            <text className="ezh-f-g is-confirmed" x="60" y="164">●</text>
            <text className="ezh-f-val" x="82" y="153">Name and specialty</text>
            <text className="ezh-f-mut" x="82" y="171">NPPES registry · read live</text>
            <rect className="ezh-f-bar" x="308" y="147" width="92" height="9" rx="4" />
          </g>
          <g className="ezh-f-arr" style={{ ['--ezh-d' as never]: '.45s' }}>
            <rect className="ezh-f-tile" x="44" y="194" width="372" height="52" rx="3" />
            <text className="ezh-f-g is-snapshot" x="60" y="226">◐</text>
            <text className="ezh-f-val" x="82" y="215">Exclusion screen</text>
            <text className="ezh-f-mut" x="82" y="233">OIG LEIE · monthly snapshot</text>
            <rect className="ezh-f-bar" x="308" y="209" width="72" height="9" rx="4" />
          </g>
          <g className="ezh-f-arr" style={{ ['--ezh-d' as never]: '.65s' }}>
            <rect className="ezh-f-tile is-open" x="44" y="256" width="372" height="52" rx="3" />
            <text className="ezh-f-g is-access" x="60" y="288">⊘</text>
            <text className="ezh-f-val" x="82" y="277">State licensure</text>
            <text className="ezh-f-mut" x="82" y="295">access-gated · only you can open it</text>
          </g>
          <g className="ezh-f-arr" style={{ ['--ezh-d' as never]: '.85s' }}>
            <rect className="ezh-f-tile is-open" x="44" y="318" width="372" height="52" rx="3" />
            <text className="ezh-f-g is-unchecked" x="60" y="350">○</text>
            <text className="ezh-f-val" x="82" y="339">Employment history</text>
            <text className="ezh-f-mut" x="82" y="357">not checked · nobody has looked</text>
          </g>
        </svg>

        {/* narrow variant — phones; re-composed, not scaled */}
        <svg className="ezh-fig-narrow" viewBox="0 0 330 384" focusable="false">
          <path
            className="ezh-f-ecg"
            style={{ ['--ezh-len' as never]: '430' }}
            d="M6 34 H70 l6-14 5 26 5-22 5 10 H150 l7-17 4 24 5-14 H324"
          />
          <text className="ezh-f-lbl" x="6" y="18">Sources read on their own cadence</text>

          <rect className="ezh-f-field" x="12" y="50" width="112" height="22" rx="3" />
          <text className="ezh-f-lbl" x="22" y="65">Your record</text>

          <rect className="ezh-f-paper" x="12" y="72" width="306" height="304" rx="3" />
          <text className="ezh-f-data" x="28" y="98">NPI ··· ··· ····</text>
          <path className="ezh-f-hair" d="M28 110 H302" />

          <g className="ezh-f-arr" style={{ ['--ezh-d' as never]: '.25s' }}>
            <rect className="ezh-f-tile" x="28" y="122" width="274" height="54" rx="3" />
            <text className="ezh-f-g is-confirmed" x="42" y="156">●</text>
            <text className="ezh-f-val" x="62" y="144">Name and specialty</text>
            <text className="ezh-f-mut" x="62" y="163">NPPES · read live</text>
            <rect className="ezh-f-bar" x="222" y="138" width="64" height="9" rx="4" />
          </g>
          <g className="ezh-f-arr" style={{ ['--ezh-d' as never]: '.45s' }}>
            <rect className="ezh-f-tile" x="28" y="186" width="274" height="54" rx="3" />
            <text className="ezh-f-g is-snapshot" x="42" y="220">◐</text>
            <text className="ezh-f-val" x="62" y="208">Exclusion screen</text>
            <text className="ezh-f-mut" x="62" y="227">OIG LEIE · monthly snapshot</text>
          </g>
          <g className="ezh-f-arr" style={{ ['--ezh-d' as never]: '.65s' }}>
            <rect className="ezh-f-tile is-open" x="28" y="250" width="274" height="54" rx="3" />
            <text className="ezh-f-g is-access" x="42" y="284">⊘</text>
            <text className="ezh-f-val" x="62" y="272">State licensure</text>
            <text className="ezh-f-mut" x="62" y="291">access-gated · only you</text>
          </g>
          <g className="ezh-f-arr" style={{ ['--ezh-d' as never]: '.85s' }}>
            <rect className="ezh-f-tile is-open" x="28" y="314" width="274" height="54" rx="3" />
            <text className="ezh-f-g is-unchecked" x="42" y="348">○</text>
            <text className="ezh-f-val" x="62" y="336">Employment history</text>
            <text className="ezh-f-mut" x="62" y="355">not checked · nobody has looked</text>
          </g>
        </svg>
      </div>
      <figcaption className="ezh-fig-cap">
        <span className="ezh-sr">{TRANSCRIPT} </span>
        Illustrative — the real source registry, with values as blank bars because the real ones
        are yours. Every row carries glyph, word, source and cadence.
      </figcaption>
    </figure>
  );
}
