'use client';

import { useEffect, useState, type CSSProperties } from 'react';

/**
 * WorkSurface — Figure 1, where the record comes from (amendment E).
 *
 * The homepage's hero illustration is now a drawn inline-SVG figure in the
 * register inks: three named public sources return what they hold into one
 * profile, and one row stays visibly open because no source answered it —
 * only the clinician can complete it. Every value is a blank bar; the open
 * row is the honest part of the drawing.
 *
 * Amendment E.2 (founder-selected Option 1 "Chart & Badge") frames the
 * profile as a clinician's ID badge — accent band, punched lanyard slot,
 * empty photo frame, blank identity bars — whose chart rows fill from
 * labelled source pills, each carrying a 2px-stroke clinical pictogram:
 * registry building, cross-in-shield (the sparing use), flag. Objects only:
 * no pictogram depicts a source response, count, person, or result (EC-25),
 * and the rejected Option 2/3 motifs (EKG connective lines, drawn clinician
 * characters) appear nowhere. On arming, the badge swings on and settles
 * once, the outline and connector arrows line-draw, and the rows slide/fade
 * in sequence — all one-shot, all resting complete.
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

/**
 * Resting dash lengths for the one-shot line-draw (`.ezh .ezh-draw` in
 * easy-home.css): each value is ≥ the element's REAL path length, so the
 * resting stroke is one dash covering the whole path — visually solid with
 * or without the animation. Chromium does not scale CSS dash values by the
 * SVG `pathLength` attribute (measured in-browser 2026-08-16), so the
 * lengths are explicit.
 */
const DRAW_90 = { '--ezh-draw-len': '90' } as CSSProperties; // wide connector arrows (~79px)
const DRAW_60 = { '--ezh-draw-len': '60' } as CSSProperties; // narrow connector arrows (~51px)
const DRAW_1660 = { '--ezh-draw-len': '1660' } as CSSProperties; // wide badge outline (1615px measured)
const DRAW_1400 = { '--ezh-draw-len': '1400' } as CSSProperties; // narrow badge outline (~1364px)

type Stage = 'static' | 'armed' | 'run' | 'done';

export default function WorkSurface() {
  const [stage, setStage] = useState<Stage>('static');

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) return undefined;

    setStage('armed');
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      // Advance only from 'armed': in a tab that loads hidden, rAF is frozen
      // while timers still fire, so the settle timeout below can land FIRST —
      // and an unconditional set here would then drag 'done' back to 'run'
      // forever (observed in-browser 2026-08-16).
      second = window.requestAnimationFrame(
        () => setStage((s) => (s === 'armed' ? 'run' : s)),
      );
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
      aria-label="Drawn illustration: three named public sources return what they hold into one clinician profile, drawn as a clinician's ID badge, with one row left open."
    >
      <div className="ezh-fig-art" aria-hidden="true">
        <svg className="ezh-fig-wide" viewBox="0 0 520 406" focusable="false">
          {/* Labelled source PILLS (Option 1 "Chart & Badge" — pills are the
              ratified shape for source-name word-labels) with the E.2 clinical
              pictograms: registry building, cross-in-shield, flag — 2px-stroke
              objects that depict no fact. */}
          <g fill="none" stroke="currentColor" strokeOpacity=".22">
            <rect x="4" y="4" width="156" height="40" rx="20" />
            <rect x="182" y="4" width="156" height="40" rx="20" />
            <rect x="360" y="4" width="156" height="40" rx="20" />
          </g>
          <g
            fill="none"
            stroke="currentColor"
            strokeOpacity=".45"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* registry building */}
            <polyline points="19,21 28,13 37,21" />
            <path d="M22 24 V31 M28 23.5 V31 M34 24 V31 M19 31 H37" />
            {/* state-board cross-in-shield (the sparing use) */}
            <path d="M205 13 l7 2.6 v5.2 c0 4.8 -3 7.9 -7 9.7 c-4 -1.8 -7 -4.9 -7 -9.7 v-5.2 z" />
            <path d="M205 17.5 v6 M202 20.5 h6" />
            {/* federal-list flag */}
            <path d="M375 31 V13 M375 14.5 h12 v7 h-12" />
          </g>
          <g fontSize="15" fill="currentColor">
            <text x="44" y="29">NPPES registry</text>
            <text x="218" y="29">State board</text>
            <text x="393" y="29">Federal list</text>
          </g>
          <g stroke="currentColor" strokeOpacity=".4">
            <line className="ezh-draw ezh-draw-d2" style={DRAW_90} x1="82" y1="46" x2="150" y2="86" markerEnd="url(#ezh-ar)" />
            <line className="ezh-draw ezh-draw-d2" style={DRAW_90} x1="260" y1="46" x2="260" y2="86" markerEnd="url(#ezh-ar)" />
            <line className="ezh-draw ezh-draw-d2" style={DRAW_90} x1="438" y1="46" x2="372" y2="86" markerEnd="url(#ezh-ar)" />
          </g>
          <text x="272" y="70" fontSize="14" fill="currentColor" fillOpacity=".62">returns what it holds</text>

          {/* The profile, drawn as a clinician's ID badge (Option 1 "Chart &
              Badge"): accent band, punched lanyard slot, empty photo frame,
              blank identity bars. The group swings on once and settles. */}
          <g className="ezh-badge">
          <rect className="ezh-draw" style={DRAW_1660} x="4" y="94" width="512" height="308" rx="14" fill="none" stroke="currentColor" strokeOpacity=".22" />
          <path
            className="ezh-fh"
            d="M4 112 v-4 c0 -7.7 6.3 -14 14 -14 h484 c7.7 0 14 6.3 14 14 v4 z"
          />
          <rect className="ezh-slot" x="246" y="99" width="28" height="6" rx="3" fill="none" strokeWidth="2" />
          <rect x="22" y="118" width="44" height="46" rx="6" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="2" />
          <line x1="28" y1="158" x2="60" y2="124" stroke="currentColor" strokeOpacity=".18" strokeWidth="2" />
          <text x="78" y="134" fontSize="15.5" fontWeight="600" fill="currentColor">Your profile</text>
          <rect className="ezh-fb" x="78" y="144" width="110" height="9" rx="4" />
          <text x="498" y="134" fontSize="14" fill="currentColor" fillOpacity=".55" textAnchor="end">NPI &bull;&bull;&bull; &bull;&bull;&bull; &bull;&bull;&bull;&bull;</text>
          <line x1="4" y1="176" x2="516" y2="176" stroke="currentColor" strokeOpacity=".14" />

          <g className="ezh-rowfx" data-r="1">
            <text x="22" y="205" fontSize="15.5" fill="currentColor">Name and specialty</text>
            <rect className="ezh-fb" x="190" y="196" width="104" height="9" rx="4" />
            <text x="498" y="205" fontSize="14" fill="currentColor" fillOpacity=".55" textAnchor="end">NPPES registry</text>
            <line x1="22" y1="222" x2="498" y2="222" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="2">
            <text x="22" y="251" fontSize="15.5" fill="currentColor">Practice location</text>
            <rect className="ezh-fb" x="190" y="242" width="132" height="9" rx="4" />
            <text x="498" y="251" fontSize="14" fill="currentColor" fillOpacity=".55" textAnchor="end">NPPES registry</text>
            <line x1="22" y1="268" x2="498" y2="268" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="3">
            <text x="22" y="297" fontSize="15.5" fill="currentColor">State license record</text>
            <rect className="ezh-fb" x="190" y="288" width="88" height="9" rx="4" />
            <text x="498" y="297" fontSize="14" fill="currentColor" fillOpacity=".55" textAnchor="end">State board</text>
            <line x1="22" y1="314" x2="498" y2="314" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="4">
            <text x="22" y="343" fontSize="15.5" fill="currentColor">Federal exclusion list</text>
            <text x="498" y="343" fontSize="14" fill="currentColor" fillOpacity=".55" textAnchor="end">Checked</text>
            <line x1="22" y1="360" x2="498" y2="360" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="5">
            <rect x="16" y="368" width="488" height="28" rx="6" fill="none" className="ezh-sh" strokeDasharray="4 3" />
            <text x="22" y="387" fontSize="15.5" className="ezh-fh">Preferred location</text>
            <text x="498" y="387" fontSize="14" className="ezh-fh" textAnchor="end">no source answered &mdash; only you can</text>
          </g>
          </g>
        </svg>

        <svg className="ezh-fig-narrow" viewBox="0 0 330 464" focusable="false">
          {/* Narrow source pills: pictogram above the label. */}
          <g fill="none" stroke="currentColor" strokeOpacity=".22">
            <rect x="2" y="2" width="103" height="44" rx="22" />
            <rect x="113" y="2" width="103" height="44" rx="22" />
            <rect x="224" y="2" width="104" height="44" rx="22" />
          </g>
          <g
            fill="none"
            stroke="currentColor"
            strokeOpacity=".45"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* registry building */}
            <polyline points="46,16 53,10 60,16" />
            <path d="M48.5 18.5 V23 M53 18 V23 M57.5 18.5 V23 M46 23 H60" />
            {/* state-board cross-in-shield (the sparing use) */}
            <path d="M164 9.5 l5.5 2 v4 c0 3.8 -2.3 6.2 -5.5 7.7 c-3.2 -1.5 -5.5 -3.9 -5.5 -7.7 v-4 z" />
            <path d="M164 13 v5 M161.5 15.5 h5" />
            {/* federal-list flag */}
            <path d="M272 23.5 V9.5 M272 10.5 h9 v5.5 h-9" />
          </g>
          <g fontSize="13" fill="currentColor" textAnchor="middle">
            <text x="53" y="38">NPPES</text>
            <text x="164" y="38">State board</text>
            <text x="276" y="38">Federal list</text>
          </g>
          <g stroke="currentColor" strokeOpacity=".4">
            <line className="ezh-draw ezh-draw-d2" style={DRAW_60} x1="53" y1="48" x2="90" y2="82" markerEnd="url(#ezh-ar)" />
            <line className="ezh-draw ezh-draw-d2" style={DRAW_60} x1="164" y1="48" x2="164" y2="82" markerEnd="url(#ezh-ar)" />
            <line className="ezh-draw ezh-draw-d2" style={DRAW_60} x1="276" y1="48" x2="238" y2="82" markerEnd="url(#ezh-ar)" />
          </g>
          <text x="176" y="68" fontSize="13" fill="currentColor" fillOpacity=".62">returns what it holds</text>

          {/* The badge (Option 1 "Chart & Badge"): accent band, slot, photo
              frame, identity bar, then the chart rows. */}
          <g className="ezh-badge">
          <rect className="ezh-draw" style={DRAW_1400} x="2" y="90" width="326" height="368" rx="14" fill="none" stroke="currentColor" strokeOpacity=".22" />
          <path
            className="ezh-fh"
            d="M2 106 v-2 c0 -7.7 6.3 -14 14 -14 h298 c7.7 0 14 6.3 14 14 v2 z"
          />
          <rect className="ezh-slot" x="151" y="95" width="28" height="6" rx="3" fill="none" strokeWidth="2" />
          <rect x="18" y="112" width="38" height="40" rx="5" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="2" />
          <line x1="23" y1="147" x2="51" y2="117" stroke="currentColor" strokeOpacity=".18" strokeWidth="2" />
          <text x="66" y="126" fontSize="13" fontWeight="600" fill="currentColor">Your profile</text>
          <rect className="ezh-fb" x="66" y="134" width="84" height="8" rx="4" />
          <text x="312" y="126" fontSize="13" fill="currentColor" fillOpacity=".55" textAnchor="end">&bull;&bull;&bull; &bull;&bull;&bull; &bull;&bull;&bull;&bull;</text>
          <line x1="2" y1="162" x2="328" y2="162" stroke="currentColor" strokeOpacity=".14" />

          <g className="ezh-rowfx" data-r="1">
            <text x="18" y="188" fontSize="13" fill="currentColor">Name and specialty</text>
            <text x="18" y="207" fontSize="13" fill="currentColor" fillOpacity=".55">NPPES registry</text>
            <rect className="ezh-fb" x="200" y="180" width="112" height="9" rx="4" />
            <line x1="18" y1="220" x2="312" y2="220" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="2">
            <text x="18" y="246" fontSize="13" fill="currentColor">Practice location</text>
            <text x="18" y="265" fontSize="13" fill="currentColor" fillOpacity=".55">NPPES registry</text>
            <rect className="ezh-fb" x="200" y="238" width="112" height="9" rx="4" />
            <line x1="18" y1="278" x2="312" y2="278" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="3">
            <text x="18" y="304" fontSize="13" fill="currentColor">State license record</text>
            <text x="18" y="323" fontSize="13" fill="currentColor" fillOpacity=".55">State board record</text>
            <rect className="ezh-fb" x="200" y="296" width="112" height="9" rx="4" />
            <line x1="18" y1="336" x2="312" y2="336" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="4">
            <text x="18" y="362" fontSize="13" fill="currentColor">Federal exclusion list</text>
            <text x="18" y="381" fontSize="13" fill="currentColor" fillOpacity=".55">Checked</text>
            <line x1="18" y1="394" x2="312" y2="394" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="5">
            <rect x="12" y="404" width="306" height="46" rx="6" fill="none" className="ezh-sh" strokeDasharray="4 3" />
            <text x="24" y="426" fontSize="13" className="ezh-fh">Preferred location</text>
            <text x="24" y="443" fontSize="13" className="ezh-fh">no source answered &mdash; only you can</text>
          </g>
          </g>
        </svg>
      </div>
      <figcaption className="ezh-fig-cap">
        <span className="ezh-sr">{TRANSCRIPT} </span>
        Illustrative &mdash; values are blank bars because the real ones are yours; where no
        source answered, the row stays open.
      </figcaption>
    </figure>
  );
}
