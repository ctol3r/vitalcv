/**
 * Figure 5 — how a match reads (the Roles section).
 *
 * Ported from the approved bake-off artifact
 * (`design-lab/homepage-2026-08-direction-a/index.html`). The record is scored
 * against an open role; two fit lines, one named blocker, said up front. No
 * employer, no count, no percentage — the copy family is #1267's
 * founder-approved matching section. Values are blank bars (amendment E,
 * Illustration row); the art is aria-hidden with an adjacent selectable
 * caption and a visually-hidden transcript.
 */

import type { CSSProperties } from 'react';

const TRANSCRIPT =
  'Your record is scored against an open role. The match explains itself: two lines fit, one blocker is named before you apply.';

/**
 * Resting dash lengths for the E.2 one-shot line-draw (`.ezh .ezh-draw` in
 * easy-home.css): each ≥ the element's real path length, so the resting
 * stroke is one dash covering the whole path — solid without the animation.
 */
const DRAW_820 = { '--ezh-draw-len': '820' } as CSSProperties; // wide record card (~783px)
const DRAW_170 = { '--ezh-draw-len': '170' } as CSSProperties; // wide connector (~158px)
const DRAW_1640 = { '--ezh-draw-len': '1640' } as CSSProperties; // wide role card (~1599px)
const DRAW_860 = { '--ezh-draw-len': '860' } as CSSProperties; // narrow record card (~827px)
const DRAW_40 = { '--ezh-draw-len': '40' } as CSSProperties; // narrow connector (~34px)
const DRAW_1150 = { '--ezh-draw-len': '1150' } as CSSProperties; // narrow role card (~1111px)

export default function MatchExplanationFigure() {
  return (
    <figure className="ezh-fig ezh-fig-w1000" data-home-figure="match-explanation">
      <div className="ezh-fig-art" aria-hidden="true">
        <svg className="ezh-fig-wide" viewBox="0 0 1000 250" focusable="false">
          <rect className="ezh-draw" style={DRAW_820} x="2" y="40" width="230" height="170" rx="10" fill="none" stroke="currentColor" strokeOpacity=".22" />
          <text x="20" y="68" fontSize="13.5" fontWeight="600" fill="currentColor">Your record</text>
          <g className="ezh-fb">
            <rect x="20" y="86" width="160" height="9" rx="4" />
            <rect x="20" y="108" width="120" height="9" rx="4" />
            <rect x="20" y="130" width="144" height="9" rx="4" />
          </g>
          <text x="20" y="166" fontSize="12.5" fill="currentColor" fillOpacity=".55">licenses &middot; specialty &middot; sources</text>
          <text x="20" y="196" fontSize="12.5" fill="currentColor" fillOpacity=".55">kept current, not re-typed</text>

          <path className="ezh-sh ezh-draw ezh-draw-d2" style={DRAW_170} d="M234 124 C 300 124, 310 124, 392 124" fill="none" markerEnd="url(#ezh-arh)" />
          <text x="313" y="110" fontSize="12.5" className="ezh-fh" textAnchor="middle">scored against the record</text>

          <rect className="ezh-draw ezh-draw-d3" style={DRAW_1640} x="400" y="20" width="598" height="210" rx="10" fill="none" stroke="currentColor" strokeOpacity=".26" />
          <text x="420" y="48" fontSize="13.5" fontWeight="600" fill="currentColor">An open role</text>
          {/* E.2 clinical pictogram: the role's facility — a plus-in-building
              sign, an object depicting no fact. */}
          <g fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="952" y="32" width="28" height="26" rx="4" />
            <path d="M966 38 v14 M959 45 h14" />
          </g>
          <g className="ezh-fb">
            <rect x="420" y="60" width="200" height="10" rx="4" />
            <rect x="420" y="78" width="130" height="9" rx="4" />
          </g>
          <g>
            <rect x="420" y="106" width="11" height="11" fill="currentColor" fillOpacity=".5" />
            <text x="442" y="116" fontSize="13.5" fill="currentColor">Your state license covers where the role is</text>
          </g>
          <g>
            <rect x="420" y="140" width="11" height="11" fill="currentColor" fillOpacity=".5" />
            <text x="442" y="150" fontSize="13.5" fill="currentColor">Your specialty matches what the role asks for</text>
          </g>
          <g>
            <rect x="420" y="174" width="11" height="11" fill="none" className="ezh-sh" strokeWidth="1.5" />
            <text x="442" y="184" fontSize="13.5" className="ezh-fh">Board certification isn&rsquo;t on your record yet &mdash; said up front</text>
          </g>
          <text x="420" y="214" fontSize="12.5" fill="currentColor" fillOpacity=".55">what lines up and what doesn&rsquo;t, in plain terms</text>
        </svg>

        <svg className="ezh-fig-narrow" viewBox="0 0 330 400" focusable="false">
          <rect className="ezh-draw" style={DRAW_860} x="2" y="2" width="326" height="96" rx="10" fill="none" stroke="currentColor" strokeOpacity=".22" />
          <text x="18" y="28" fontSize="13" fontWeight="600" fill="currentColor">Your record</text>
          <g className="ezh-fb">
            <rect x="18" y="44" width="200" height="9" rx="4" />
            <rect x="18" y="62" width="160" height="9" rx="4" />
          </g>
          <text x="18" y="88" fontSize="11.5" fill="currentColor" fillOpacity=".55">licenses &middot; specialty &middot; sources</text>

          <path className="ezh-sh ezh-draw ezh-draw-d2" style={DRAW_40} d="M164 98 C 164 112, 164 116, 164 132" fill="none" markerEnd="url(#ezh-arh)" />
          <text x="176" y="120" fontSize="11.5" className="ezh-fh">scored against the record</text>

          <rect className="ezh-draw ezh-draw-d3" style={DRAW_1150} x="2" y="140" width="326" height="238" rx="10" fill="none" stroke="currentColor" strokeOpacity=".26" />
          <text x="18" y="166" fontSize="13" fontWeight="600" fill="currentColor">An open role</text>
          <g fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="294" y="148" width="24" height="22" rx="4" />
            <path d="M306 153 v12 M300 159 h12" />
          </g>
          <g className="ezh-fb">
            <rect x="18" y="178" width="180" height="9" rx="4" />
          </g>
          <g>
            <rect x="18" y="202" width="10" height="10" fill="currentColor" fillOpacity=".5" />
            <text x="36" y="211" fontSize="12" fill="currentColor">Your state license covers the role</text>
          </g>
          <g>
            <rect x="18" y="234" width="10" height="10" fill="currentColor" fillOpacity=".5" />
            <text x="36" y="243" fontSize="12" fill="currentColor">Your specialty matches the ask</text>
          </g>
          <g>
            <rect x="18" y="266" width="10" height="10" fill="none" className="ezh-sh" strokeWidth="1.5" />
            <text x="36" y="275" fontSize="12" className="ezh-fh">Board certification isn&rsquo;t on</text>
            <text x="36" y="292" fontSize="12" className="ezh-fh">your record yet &mdash; said up front,</text>
            <text x="36" y="309" fontSize="12" className="ezh-fh">not after the interview</text>
          </g>
          <text x="18" y="348" fontSize="11.5" fill="currentColor" fillOpacity=".55">what lines up and what doesn&rsquo;t,</text>
          <text x="18" y="364" fontSize="11.5" fill="currentColor" fillOpacity=".55">in plain terms</text>
        </svg>
      </div>
      <figcaption className="ezh-fig-cap">
        <span className="ezh-sr">{TRANSCRIPT} </span>
        Illustrative &mdash; the shape of a match, not a real posting or employer.
      </figcaption>
    </figure>
  );
}
