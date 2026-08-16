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

const TRANSCRIPT =
  'Your record is scored against an open role. The match explains itself: two lines fit, one blocker is named before you apply.';

export default function MatchExplanationFigure() {
  return (
    <figure className="ezh-fig ezh-fig-w1000" data-home-figure="match-explanation">
      <div className="ezh-fig-art" aria-hidden="true">
        <svg className="ezh-fig-wide" viewBox="0 0 1000 250" focusable="false">
          <rect x="2" y="40" width="230" height="170" rx="10" fill="none" stroke="currentColor" strokeOpacity=".22" />
          <text x="20" y="68" fontSize="13.5" fontWeight="600" fill="currentColor">Your record</text>
          <g className="ezh-fb">
            <rect x="20" y="86" width="160" height="9" rx="4" />
            <rect x="20" y="108" width="120" height="9" rx="4" />
            <rect x="20" y="130" width="144" height="9" rx="4" />
          </g>
          <text x="20" y="166" fontSize="12.5" fill="currentColor" fillOpacity=".55">licenses &middot; specialty &middot; sources</text>
          <text x="20" y="196" fontSize="12.5" fill="currentColor" fillOpacity=".55">kept current, not re-typed</text>

          <path d="M234 124 C 300 124, 310 124, 392 124" fill="none" className="ezh-sh" markerEnd="url(#ezh-arh)" />
          <text x="313" y="110" fontSize="12.5" className="ezh-fh" textAnchor="middle">scored against the record</text>

          <rect x="400" y="20" width="598" height="210" rx="10" fill="none" stroke="currentColor" strokeOpacity=".26" />
          <text x="420" y="48" fontSize="13.5" fontWeight="600" fill="currentColor">An open role</text>
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
          <rect x="2" y="2" width="326" height="96" rx="10" fill="none" stroke="currentColor" strokeOpacity=".22" />
          <text x="18" y="28" fontSize="13" fontWeight="600" fill="currentColor">Your record</text>
          <g className="ezh-fb">
            <rect x="18" y="44" width="200" height="9" rx="4" />
            <rect x="18" y="62" width="160" height="9" rx="4" />
          </g>
          <text x="18" y="88" fontSize="11.5" fill="currentColor" fillOpacity=".55">licenses &middot; specialty &middot; sources</text>

          <path d="M164 98 C 164 112, 164 116, 164 132" fill="none" className="ezh-sh" markerEnd="url(#ezh-arh)" />
          <text x="176" y="120" fontSize="11.5" className="ezh-fh">scored against the record</text>

          <rect x="2" y="140" width="326" height="238" rx="10" fill="none" stroke="currentColor" strokeOpacity=".26" />
          <text x="18" y="166" fontSize="13" fontWeight="600" fill="currentColor">An open role</text>
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
        Illustrative &mdash; the shape of a match, not a real posting or a real employer. Fit
        lines and blockers are the kind the scoring engine actually returns.
      </figcaption>
    </figure>
  );
}
