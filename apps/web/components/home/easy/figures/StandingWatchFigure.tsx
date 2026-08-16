/**
 * Figure 6 — the standing watch ("Most weeks, you do nothing.").
 *
 * Ported from the approved bake-off artifact. Your lane runs unchanged;
 * VitalCV's lane ticks below it — renewal dates watched, the record refreshed
 * from its public sources, quiet while nothing changes. The one accent moment
 * is the only time you are needed. Everything drawn is the cadence, not a
 * log: no dates, no counts, no source response that did not occur.
 */

const TRANSCRIPT =
  'Your week runs unchanged while VitalCV watches renewal dates and refreshes the record in the background. The one marked moment is the only time you are needed.';

export default function StandingWatchFigure() {
  return (
    <figure className="ezh-fig ezh-fig-w1000" data-home-figure="standing-watch">
      <div className="ezh-fig-art" aria-hidden="true">
        <svg className="ezh-fig-wide" viewBox="0 0 1000 200" focusable="false">
          <text x="14" y="45" fontSize="13.5" fontWeight="600" fill="currentColor">You</text>
          <line x1="70" y1="40" x2="960" y2="40" stroke="currentColor" strokeOpacity=".3" />
          <text x="515" y="26" fontSize="12.5" fill="currentColor" fillOpacity=".55" textAnchor="middle">your week, unchanged</text>

          <text x="14" y="150" fontSize="13.5" fontWeight="600" fill="currentColor">VitalCV</text>
          <line x1="70" y1="145" x2="960" y2="145" stroke="currentColor" strokeOpacity=".3" />

          <g stroke="currentColor" strokeOpacity=".45" strokeWidth="1.5">
            <line x1="200" y1="145" x2="200" y2="131" />
            <line x1="430" y1="145" x2="430" y2="131" />
            <line x1="660" y1="145" x2="660" y2="131" />
          </g>
          <g fontSize="12.5" fill="currentColor" fillOpacity=".62" textAnchor="middle">
            <text x="200" y="172">renewal dates watched</text>
            <text x="430" y="172">record refreshed &mdash; NPPES</text>
            <text x="660" y="172">quiet &mdash; nothing changed</text>
          </g>

          <line x1="870" y1="145" x2="870" y2="131" className="ezh-sh" strokeWidth="1.5" />
          <text x="870" y="172" fontSize="12.5" className="ezh-fh" textAnchor="middle">needs you: one approval</text>
          <path d="M870 128 C 870 96, 870 84, 870 52" fill="none" className="ezh-sh" markerEnd="url(#ezh-arh)" />
          <text x="858" y="92" fontSize="12.5" className="ezh-fh" textAnchor="end">the only interruption</text>
        </svg>

        <svg className="ezh-fig-narrow" viewBox="0 0 330 330" focusable="false">
          <text x="52" y="28" fontSize="11.5" fill="currentColor" fillOpacity=".55">VitalCV, in the background</text>
          <line x1="30" y1="20" x2="30" y2="310" stroke="currentColor" strokeOpacity=".3" />
          <g stroke="currentColor" strokeOpacity=".45" strokeWidth="1.5">
            <line x1="30" y1="60" x2="44" y2="60" />
            <line x1="30" y1="120" x2="44" y2="120" />
            <line x1="30" y1="180" x2="44" y2="180" />
          </g>
          <g fontSize="12" fill="currentColor">
            <text x="52" y="64">renewal dates watched</text>
            <text x="52" y="124">record refreshed &mdash; NPPES</text>
            <text x="52" y="184">quiet &mdash; nothing changed</text>
          </g>
          <line x1="30" y1="250" x2="44" y2="250" className="ezh-sh" strokeWidth="1.5" />
          <text x="52" y="254" fontSize="12" className="ezh-fh">needs you: one approval</text>
          <text x="52" y="272" fontSize="11.5" className="ezh-fh">the only interruption</text>
        </svg>
      </div>
      <figcaption className="ezh-fig-cap">
        <span className="ezh-sr">{TRANSCRIPT} </span>
        Illustrative &mdash; the cadence, not a log. Quiet is the default; the one marked
        moment is the only time you&rsquo;re needed.
      </figcaption>
    </figure>
  );
}
