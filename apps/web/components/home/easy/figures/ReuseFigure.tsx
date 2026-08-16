/**
 * Figure 4 — reuse (lives in the dark band, as step 7's expansion).
 *
 * Ported from the approved bake-off artifact. One profile, built once, feeds
 * each application in turn without being rebuilt — the drawing shows the
 * reuse, which is the whole point. Mounted directly under the seven-step
 * track, anchored to the pinned "Reuse" step; on the ink ground its accent
 * marks resolve through the band figure-accent token and the band marker.
 */

const TRANSCRIPT =
  'One profile, built once, feeds each application in turn without being rebuilt.';

export default function ReuseFigure() {
  return (
    <figure className="ezh-fig ezh-fig-w1000" data-home-figure="reuse">
      <div className="ezh-fig-art" aria-hidden="true">
        <svg className="ezh-fig-wide" viewBox="0 0 1000 190" focusable="false">
          <rect x="2" y="42" width="200" height="106" rx="10" fill="none" className="ezh-sh" />
          <text x="20" y="70" fontSize="13" fontWeight="600" className="ezh-fh">One profile</text>
          <g className="ezh-fb">
            <rect x="20" y="86" width="164" height="9" rx="4" />
            <rect x="20" y="104" width="132" height="9" rx="4" />
            <rect x="20" y="122" width="148" height="9" rx="4" />
          </g>
          <g className="ezh-sh" fill="none">
            <path d="M202 76 C 300 76, 300 46, 396 46" markerEnd="url(#ezh-arb)" />
            <path d="M202 95 C 300 95, 300 95, 396 95" markerEnd="url(#ezh-arb)" />
            <path d="M202 114 C 300 114, 300 144, 396 144" markerEnd="url(#ezh-arb)" />
          </g>
          <text x="238" y="168" fontSize="12.5" fill="currentColor" fillOpacity=".62">reused &mdash; never rebuilt</text>
          <g fill="none" stroke="currentColor" strokeOpacity=".26">
            <rect x="402" y="26" width="250" height="40" rx="8" />
            <rect x="402" y="75" width="250" height="40" rx="8" />
            <rect x="402" y="124" width="250" height="40" rx="8" />
          </g>
          <g fontSize="13.5" fill="currentColor">
            <text x="422" y="51">Application &mdash; first role</text>
            <text x="422" y="100">Application &mdash; next role</text>
            <text x="422" y="149">Application &mdash; the one after</text>
          </g>
          <g fontSize="12.5" fill="currentColor" fillOpacity=".55">
            <text x="672" y="51">approved each time</text>
            <text x="672" y="100">approved each time</text>
            <text x="672" y="149">approved each time</text>
          </g>
        </svg>

        <svg className="ezh-fig-narrow" viewBox="0 0 330 316" focusable="false">
          <rect x="2" y="2" width="326" height="96" rx="10" fill="none" className="ezh-sh" />
          <text x="18" y="28" fontSize="13" fontWeight="600" className="ezh-fh">One profile</text>
          <g className="ezh-fb">
            <rect x="18" y="44" width="280" height="9" rx="4" />
            <rect x="18" y="62" width="228" height="9" rx="4" />
            <rect x="18" y="80" width="256" height="9" rx="4" />
          </g>
          <g className="ezh-sh" fill="none">
            <path d="M70 98 C 70 118, 60 118, 60 136" markerEnd="url(#ezh-arb)" />
            <path d="M164 98 C 164 118, 164 118, 164 136" markerEnd="url(#ezh-arb)" />
            <path d="M258 98 C 258 118, 270 118, 270 136" markerEnd="url(#ezh-arb)" />
          </g>
          <text x="18" y="130" fontSize="11.5" fill="currentColor" fillOpacity=".6">reused &mdash; never rebuilt</text>
          <g fill="none" stroke="currentColor" strokeOpacity=".26">
            <rect x="2" y="140" width="326" height="52" rx="8" />
            <rect x="2" y="200" width="326" height="52" rx="8" />
            <rect x="2" y="260" width="326" height="52" rx="8" />
          </g>
          <g fontSize="13.5" fill="currentColor">
            <text x="18" y="163">Application &mdash; first role</text>
            <text x="18" y="223">Application &mdash; next role</text>
            <text x="18" y="283">Application &mdash; the one after</text>
          </g>
          <g fontSize="11.5" fill="currentColor" fillOpacity=".55">
            <text x="18" y="181">approved each time</text>
            <text x="18" y="241">approved each time</text>
            <text x="18" y="301">approved each time</text>
          </g>
        </svg>
      </div>
      <figcaption className="ezh-fig-cap">
        <span className="ezh-sr">{TRANSCRIPT} </span>
        Illustrative. The drawing shows the reuse, which is the whole point &mdash; the profile
        is not rebuilt for each application.
      </figcaption>
    </figure>
  );
}
