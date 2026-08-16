'use client';

import { useEffect, useState } from 'react';

/**
 * WorkSurface — Figure 1, where the record comes from (amendment E).
 *
 * The homepage's hero illustration is now a drawn inline-SVG figure in the
 * register inks: three named public sources return what they hold into one
 * profile, and one row stays visibly open because no source answered it —
 * only the clinician can complete it. Every value is a blank bar; the open
 * row is the honest part of the drawing.
 *
 * SSR completeness: the figure is fully present in the server frame. The
 * one-shot row reveal is an ENHANCEMENT — rows are visible unless hydration
 * explicitly arms the animation, the reveal runs once, and a safety timeout
 * strips the machinery so a transition that never paints can strand nothing.
 * Reduced motion never arms it.
 *
 * Arrowheads reference the hoisted markers in `figures/FigureMarkers.tsx` —
 * defs inside this figure would vanish with the `display: none` wide variant
 * on a phone.
 */

const TRANSCRIPT =
  'Three named public sources return what they hold into your profile. One row stays open because no source answered it, and only you can complete it.';

type Stage = 'static' | 'armed' | 'run' | 'done';

export default function WorkSurface() {
  const [stage, setStage] = useState<Stage>('static');

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) return undefined;

    setStage('armed');
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => setStage('run'));
    });
    // Safety: whatever the transitions did, the finished frame stands.
    const settle = window.setTimeout(() => setStage('done'), 2400);
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
      className="ezh-surface ezh-fig ezh-fig-hero"
      data-home-work-surface=""
      data-home-figure="sources-to-profile"
      data-visual-material="drawn-ink"
      data-motion={stage}
      aria-label="Drawn illustration: three named public sources return what they hold into one clinician profile, with one row left open."
    >
      <div className="ezh-fig-art" aria-hidden="true">
        <svg className="ezh-fig-wide" viewBox="0 0 520 372" focusable="false">
          <g fill="none" stroke="currentColor" strokeOpacity=".22">
            <rect x="4" y="4" width="156" height="40" rx="7" />
            <rect x="182" y="4" width="156" height="40" rx="7" />
            <rect x="360" y="4" width="156" height="40" rx="7" />
          </g>
          <g fontSize="15" fill="currentColor" textAnchor="middle">
            <text x="82" y="29">NPPES registry</text>
            <text x="260" y="29">State board</text>
            <text x="438" y="29">Federal list</text>
          </g>
          <g stroke="currentColor" strokeOpacity=".4">
            <line x1="82" y1="46" x2="150" y2="86" markerEnd="url(#ezh-ar)" />
            <line x1="260" y1="46" x2="260" y2="86" markerEnd="url(#ezh-ar)" />
            <line x1="438" y1="46" x2="372" y2="86" markerEnd="url(#ezh-ar)" />
          </g>
          <text x="272" y="70" fontSize="14" fill="currentColor" fillOpacity=".62">returns what it holds</text>

          <rect x="4" y="94" width="512" height="274" rx="12" fill="none" stroke="currentColor" strokeOpacity=".22" />
          <text x="22" y="120" fontSize="15.5" fontWeight="600" fill="currentColor">Your profile</text>
          <text x="498" y="120" fontSize="14" fill="currentColor" fillOpacity=".55" textAnchor="end">NPI &bull;&bull;&bull; &bull;&bull;&bull; &bull;&bull;&bull;&bull;</text>
          <line x1="4" y1="134" x2="516" y2="134" stroke="currentColor" strokeOpacity=".14" />

          <g className="ezh-rowfx" data-r="1">
            <text x="22" y="163" fontSize="15.5" fill="currentColor">Name and specialty</text>
            <rect className="ezh-fb" x="190" y="154" width="104" height="9" rx="4" />
            <text x="498" y="163" fontSize="14" fill="currentColor" fillOpacity=".55" textAnchor="end">NPPES registry</text>
            <line x1="22" y1="180" x2="498" y2="180" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="2">
            <text x="22" y="209" fontSize="15.5" fill="currentColor">Practice location</text>
            <rect className="ezh-fb" x="190" y="200" width="132" height="9" rx="4" />
            <text x="498" y="209" fontSize="14" fill="currentColor" fillOpacity=".55" textAnchor="end">NPPES registry</text>
            <line x1="22" y1="226" x2="498" y2="226" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="3">
            <text x="22" y="255" fontSize="15.5" fill="currentColor">State license record</text>
            <rect className="ezh-fb" x="190" y="246" width="88" height="9" rx="4" />
            <text x="498" y="255" fontSize="14" fill="currentColor" fillOpacity=".55" textAnchor="end">State board</text>
            <line x1="22" y1="272" x2="498" y2="272" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="4">
            <text x="22" y="301" fontSize="15.5" fill="currentColor">Federal exclusion list</text>
            <text x="498" y="301" fontSize="14" fill="currentColor" fillOpacity=".55" textAnchor="end">Checked</text>
            <line x1="22" y1="318" x2="498" y2="318" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="5">
            <rect x="16" y="330" width="488" height="30" rx="6" fill="none" className="ezh-sh" strokeDasharray="4 3" />
            <text x="22" y="350" fontSize="15.5" className="ezh-fh">Preferred location</text>
            <text x="498" y="350" fontSize="14" className="ezh-fh" textAnchor="end">no source answered &mdash; only you can</text>
          </g>
        </svg>

        <svg className="ezh-fig-narrow" viewBox="0 0 330 430" focusable="false">
          <g fill="none" stroke="currentColor" strokeOpacity=".22">
            <rect x="2" y="2" width="103" height="36" rx="7" />
            <rect x="113" y="2" width="103" height="36" rx="7" />
            <rect x="224" y="2" width="104" height="36" rx="7" />
          </g>
          <g fontSize="12" fill="currentColor" textAnchor="middle">
            <text x="53" y="25">NPPES</text>
            <text x="164" y="25">State board</text>
            <text x="276" y="25">Federal list</text>
          </g>
          <g stroke="currentColor" strokeOpacity=".4">
            <line x1="53" y1="40" x2="90" y2="76" markerEnd="url(#ezh-ar)" />
            <line x1="164" y1="40" x2="164" y2="76" markerEnd="url(#ezh-ar)" />
            <line x1="276" y1="40" x2="238" y2="76" markerEnd="url(#ezh-ar)" />
          </g>
          <text x="176" y="63" fontSize="11.5" fill="currentColor" fillOpacity=".62">returns what it holds</text>

          <rect x="2" y="84" width="326" height="342" rx="12" fill="none" stroke="currentColor" strokeOpacity=".22" />
          <text x="18" y="110" fontSize="13" fontWeight="600" fill="currentColor">Your profile</text>
          <text x="312" y="110" fontSize="11.5" fill="currentColor" fillOpacity=".55" textAnchor="end">&bull;&bull;&bull; &bull;&bull;&bull; &bull;&bull;&bull;&bull;</text>
          <line x1="2" y1="124" x2="328" y2="124" stroke="currentColor" strokeOpacity=".14" />

          <g className="ezh-rowfx" data-r="1">
            <text x="18" y="150" fontSize="13" fill="currentColor">Name and specialty</text>
            <text x="18" y="169" fontSize="11.5" fill="currentColor" fillOpacity=".55">NPPES registry</text>
            <rect className="ezh-fb" x="200" y="142" width="112" height="9" rx="4" />
            <line x1="18" y1="182" x2="312" y2="182" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="2">
            <text x="18" y="208" fontSize="13" fill="currentColor">Practice location</text>
            <text x="18" y="227" fontSize="11.5" fill="currentColor" fillOpacity=".55">NPPES registry</text>
            <rect className="ezh-fb" x="200" y="200" width="112" height="9" rx="4" />
            <line x1="18" y1="240" x2="312" y2="240" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="3">
            <text x="18" y="266" fontSize="13" fill="currentColor">State license record</text>
            <text x="18" y="285" fontSize="11.5" fill="currentColor" fillOpacity=".55">State board record</text>
            <rect className="ezh-fb" x="200" y="258" width="112" height="9" rx="4" />
            <line x1="18" y1="298" x2="312" y2="298" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="4">
            <text x="18" y="324" fontSize="13" fill="currentColor">Federal exclusion list</text>
            <text x="18" y="343" fontSize="11.5" fill="currentColor" fillOpacity=".55">Checked</text>
            <line x1="18" y1="356" x2="312" y2="356" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="5">
            <rect x="12" y="368" width="306" height="46" rx="6" fill="none" className="ezh-sh" strokeDasharray="4 3" />
            <text x="24" y="390" fontSize="13" className="ezh-fh">Preferred location</text>
            <text x="24" y="407" fontSize="11.5" className="ezh-fh">no source answered &mdash; only you can</text>
          </g>
        </svg>
      </div>
      <figcaption className="ezh-fig-cap">
        <span className="ezh-sr">{TRANSCRIPT} </span>
        Illustrative. Values are shown as blank bars because the real ones are yours &mdash;
        and where no source answered, the profile leaves the row open instead of guessing.
      </figcaption>
    </figure>
  );
}
