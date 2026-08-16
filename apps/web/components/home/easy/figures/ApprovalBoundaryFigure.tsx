/**
 * Figure 3 — the approval boundary (the dark band's drawn stage).
 *
 * Ported from the approved bake-off artifact. Six rows stay, three cross; the
 * dashed line is your approval. It redraws the career-mobility band's
 * MATERIAL, not its story — the seven pinned steps and both boundary
 * sentences are unchanged (amendment E, dark-band row). Accent marks route
 * through the band's own figure-accent token because the paper accent is
 * illegible on ink; arrows reference the band marker for the same reason.
 */

const TRANSCRIPT =
  'Your complete profile stays with you. On approval, a copy carrying only the approved rows crosses to the employer’s review.';

export default function ApprovalBoundaryFigure() {
  return (
    <figure className="ezh-fig ezh-fig-w620" data-home-figure="approval-boundary">
      <div className="ezh-fig-art" aria-hidden="true">
        <svg className="ezh-fig-wide" viewBox="0 0 620 268" focusable="false">
          <rect x="2" y="30" width="212" height="206" rx="10" fill="none" stroke="currentColor" strokeOpacity=".3" />
          <text x="20" y="58" fontSize="14" fontWeight="600" fill="currentColor">Your complete profile</text>
          <g fill="currentColor" fillOpacity=".2">
            <rect x="20" y="74" width="172" height="9" rx="4" />
            <rect x="20" y="94" width="140" height="9" rx="4" />
            <rect x="20" y="114" width="164" height="9" rx="4" />
            <rect x="20" y="134" width="120" height="9" rx="4" />
            <rect x="20" y="154" width="152" height="9" rx="4" />
            <rect x="20" y="174" width="136" height="9" rx="4" />
          </g>
          <text x="20" y="212" fontSize="13" fill="currentColor" fillOpacity=".6">stays with you</text>

          <line x1="310" y1="26" x2="310" y2="256" className="ezh-sh" strokeDasharray="5 4" />
          <text x="310" y="16" fontSize="13" className="ezh-fh" textAnchor="middle">your approval</text>

          <path d="M214 112 C 262 112, 266 96, 326 96" fill="none" className="ezh-sh" markerEnd="url(#ezh-arb)" />
          <text x="302" y="84" fontSize="13" className="ezh-fh" textAnchor="end">approved rows</text>

          <rect x="330" y="52" width="212" height="132" rx="10" fill="none" stroke="currentColor" strokeOpacity=".3" />
          <text x="348" y="80" fontSize="14" fontWeight="600" fill="currentColor">The employer&rsquo;s review</text>
          <g fill="currentColor" fillOpacity=".2">
            <rect x="348" y="96" width="150" height="9" rx="4" />
            <rect x="348" y="116" width="120" height="9" rx="4" />
            <rect x="348" y="136" width="138" height="9" rx="4" />
          </g>
          <text x="348" y="170" fontSize="13" fill="currentColor" fillOpacity=".6">they decide, on their timeline</text>
        </svg>

        <svg className="ezh-fig-narrow" viewBox="0 0 330 400" focusable="false">
          <rect x="2" y="2" width="326" height="168" rx="10" fill="none" stroke="currentColor" strokeOpacity=".3" />
          <text x="18" y="28" fontSize="13" fontWeight="600" fill="currentColor">Your complete profile</text>
          <g fill="currentColor" fillOpacity=".2">
            <rect x="18" y="44" width="280" height="9" rx="4" />
            <rect x="18" y="64" width="230" height="9" rx="4" />
            <rect x="18" y="84" width="264" height="9" rx="4" />
            <rect x="18" y="104" width="200" height="9" rx="4" />
            <rect x="18" y="124" width="248" height="9" rx="4" />
          </g>
          <text x="18" y="156" fontSize="11.5" fill="currentColor" fillOpacity=".6">stays with you</text>

          <line x1="8" y1="196" x2="322" y2="196" className="ezh-sh" strokeDasharray="5 4" />
          <text x="18" y="190" fontSize="11.5" className="ezh-fh">your approval</text>
          <path d="M164 170 C 164 182, 164 184, 164 214" fill="none" className="ezh-sh" markerEnd="url(#ezh-arb)" />
          <text x="176" y="214" fontSize="11.5" className="ezh-fh">only approved rows</text>

          <rect x="2" y="230" width="326" height="152" rx="10" fill="none" stroke="currentColor" strokeOpacity=".3" />
          <text x="18" y="256" fontSize="13" fontWeight="600" fill="currentColor">The employer&rsquo;s review</text>
          <g fill="currentColor" fillOpacity=".2">
            <rect x="18" y="272" width="240" height="9" rx="4" />
            <rect x="18" y="292" width="190" height="9" rx="4" />
            <rect x="18" y="312" width="216" height="9" rx="4" />
          </g>
          <text x="18" y="350" fontSize="11.5" fill="currentColor" fillOpacity=".6">they decide, on their timeline</text>
        </svg>
      </div>
      <figcaption className="ezh-fig-cap">
        <span className="ezh-sr">{TRANSCRIPT} </span>
        Illustrative &mdash; no real people, and nothing has been sent.
      </figcaption>
    </figure>
  );
}
