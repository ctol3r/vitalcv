/**
 * Figure 2 — one owner per item (mounted by Attribution).
 *
 * Ported from the approved bake-off artifact. Four arrows, four destinations,
 * nothing unassigned: each remaining item routes to exactly one owner —
 * VitalCV, your approval, only you, or the employer. Values are blank bars;
 * the art is aria-hidden with an adjacent caption and hidden transcript.
 */

const TRANSCRIPT =
  'Each remaining item routes to exactly one owner: VitalCV, your approval, only you, or the employer.';

export default function OwnerRoutingFigure() {
  return (
    <figure className="ezh-fig ezh-fig-w1000" data-home-figure="owner-routing">
      <div className="ezh-fig-art" aria-hidden="true">
        <svg className="ezh-fig-wide" viewBox="0 0 1000 240" focusable="false">
          <rect x="2" y="62" width="196" height="116" rx="10" fill="none" stroke="currentColor" strokeOpacity=".22" />
          <text x="20" y="90" fontSize="13" fontWeight="600" fill="currentColor">What&rsquo;s left</text>
          <g className="ezh-fb">
            <rect x="20" y="104" width="160" height="9" rx="4" />
            <rect x="20" y="122" width="132" height="9" rx="4" />
            <rect x="20" y="140" width="148" height="9" rx="4" />
            <rect x="20" y="158" width="112" height="9" rx="4" />
          </g>
          <g stroke="currentColor" strokeOpacity=".38" fill="none">
            <path d="M198 108 C 280 108, 280 34, 360 34" markerEnd="url(#ezh-ar)" />
            <path d="M198 126 C 280 126, 280 104, 360 104" markerEnd="url(#ezh-ar)" />
            <path d="M198 144 C 280 144, 280 172, 360 172" markerEnd="url(#ezh-ar)" />
            <path d="M198 162 C 280 162, 280 226, 360 226" markerEnd="url(#ezh-ar)" />
          </g>
          <text x="252" y="200" fontSize="12.5" fill="currentColor" fillOpacity=".62">exactly one owner</text>
          <g fill="none">
            <rect x="366" y="14" width="300" height="40" rx="8" className="ezh-sh" />
            <rect x="366" y="84" width="300" height="40" rx="8" stroke="currentColor" strokeOpacity=".26" />
            <rect x="366" y="152" width="300" height="40" rx="8" stroke="currentColor" strokeOpacity=".26" />
            <rect x="366" y="206" width="300" height="40" rx="8" stroke="currentColor" strokeOpacity=".26" />
          </g>
          <g fontSize="13.5">
            <text x="386" y="39" className="ezh-fh" fontWeight="600">VitalCV does it</text>
            <text x="386" y="109" fill="currentColor">Waits for your approval</text>
            <text x="386" y="177" fill="currentColor">Only you can do it</text>
            <text x="386" y="231" fill="currentColor">The employer decides</text>
          </g>
          <g fontSize="12.5" fill="currentColor" fillOpacity=".55">
            <text x="686" y="39">public records, drafts, renewal dates</text>
            <text x="686" y="109">sending your profile, requesting a reference</text>
            <text x="686" y="177">occupational health forms</text>
            <text x="686" y="231">interview and facility sign-off</text>
          </g>
        </svg>

        <svg className="ezh-fig-narrow" viewBox="0 0 330 300" focusable="false">
          <rect x="2" y="2" width="326" height="72" rx="10" fill="none" stroke="currentColor" strokeOpacity=".22" />
          <text x="18" y="26" fontSize="13" fontWeight="600" fill="currentColor">What&rsquo;s left</text>
          <g className="ezh-fb">
            <rect x="18" y="38" width="180" height="8" rx="4" />
            <rect x="18" y="52" width="140" height="8" rx="4" />
          </g>
          <g stroke="currentColor" strokeOpacity=".38" fill="none">
            <path d="M60 74 C 60 92, 46 92, 46 108" markerEnd="url(#ezh-ar)" />
            <path d="M130 74 C 130 92, 130 92, 130 108" markerEnd="url(#ezh-ar)" />
            <path d="M200 74 C 200 92, 214 92, 214 108" markerEnd="url(#ezh-ar)" />
            <path d="M270 74 C 270 92, 292 92, 292 108" markerEnd="url(#ezh-ar)" />
          </g>
          <text x="18" y="100" fontSize="11.5" fill="currentColor" fillOpacity=".6">exactly one owner</text>
          <g fill="none">
            <rect x="2" y="112" width="326" height="40" rx="8" className="ezh-sh" />
            <rect x="2" y="160" width="326" height="40" rx="8" stroke="currentColor" strokeOpacity=".26" />
            <rect x="2" y="208" width="326" height="40" rx="8" stroke="currentColor" strokeOpacity=".26" />
            <rect x="2" y="256" width="326" height="40" rx="8" stroke="currentColor" strokeOpacity=".26" />
          </g>
          <g fontSize="13.5">
            <text x="18" y="137" className="ezh-fh" fontWeight="600">VitalCV does it</text>
            <text x="18" y="185" fill="currentColor">Waits for your approval</text>
            <text x="18" y="233" fill="currentColor">Only you can do it</text>
            <text x="18" y="281" fill="currentColor">The employer decides</text>
          </g>
        </svg>
      </div>
      <figcaption className="ezh-fig-cap">
        <span className="ezh-sr">{TRANSCRIPT} </span>
        Illustrative. The point of the drawing is the routing, not the list &mdash; nothing is
        left unassigned.
      </figcaption>
    </figure>
  );
}
