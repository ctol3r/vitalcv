/**
 * HomeFigures — the six drawn figures of the Direction A homepage register
 * (constitution amendment E, 2026-08-15).
 *
 * Ported from the committed bake-off artifact
 * `design-lab/homepage-2026-08-direction-a/index.html`, which is the record of
 * the founder's four-round verdict ("ok i like A the most. but i need
 * illustrations and visuals not just text").
 *
 * Figure doctrine, carried verbatim from the amendment's Illustration row and
 * the artifact's own verification battery:
 *
 *   - Every VALUE is a blank bar. The real ones belong to the viewer, so the
 *     drawings never carry a fabricated name, count, score, percentage,
 *     employer, NPI, source response, or completion (EC-25).
 *   - Every figure self-labels through its caption.
 *   - The art is `aria-hidden`; the sentence that describes it is adjacent
 *     selectable text (`FigureNote`), not an `aria-label` trapped on the SVG.
 *     The amendment requires the aria-hidden form; the artifact's aria-labels
 *     survive as that adjacent text rather than being dropped.
 *   - Wide/narrow viewBox pairs per figure, swapped by container query — NOT by
 *     scaling one drawing down, because effective SVG text size is
 *     `font-size × rendered-width ÷ viewBox-width` and a wide figure squeezed
 *     into 390px falls under the 11px floor.
 *   - Arrowhead `<marker>` defs are HOISTED into one always-rendered sprite
 *     (`FigureMarkers`). A marker defined inside a `display:none` figure
 *     vanishes on mobile, taking every arrow that references it.
 *   - Complete in the server frame. The line-draw reveal is an enhancement
 *     layered on top; nothing here depends on it.
 *
 * Colour: line work is `currentColor`, set by the figure's CSS to
 * `--vt-home-e-figure-line`. The action accent routes through `.ezh-fig-hot`
 * so it stays an action instrument in one place and never becomes a state
 * (EC-4, amendment E action-colour row).
 */

import type { ReactNode } from 'react';

/**
 * The hoisted arrowhead sprite. Rendered ONCE per page, outside every figure.
 *
 * `fill` is an explicit literal rather than `currentColor`: a hoisted marker
 * resolves `currentColor` against ITSELF, not against the path that references
 * it, so `currentColor` here would paint black-on-anything. The two paper
 * markers sit only on light sections and the band marker only on the dark one.
 */
export function FigureMarkers() {
  return (
    <svg
      className="ezh-fig-sprite"
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <marker id="ezh-ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill="#141312" fillOpacity=".45" />
        </marker>
        <marker id="ezh-arh" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill="#D92800" />
        </marker>
        <marker id="ezh-arb" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill="#FF6B4A" />
        </marker>
      </defs>
    </svg>
  );
}

/**
 * One figure: the wide/narrow drawing pair, the describing sentence, and the
 * self-labelling caption. `note` is what a screen reader gets in place of the
 * art; `caption` is what everyone reads.
 */
function Figure({
  className,
  wide,
  narrow,
  note,
  caption,
}: {
  className?: string;
  wide: ReactNode;
  narrow: ReactNode;
  note: string;
  caption: string;
}) {
  return (
    <figure className={className ? `ezh-fig ${className}` : 'ezh-fig'}>
      {wide}
      {narrow}
      <figcaption className="ezh-fig-cap">
        <span className="ezh-sr">{note}</span>
        {caption}
      </figcaption>
    </figure>
  );
}

/* ── figure 1 — where the record comes from ─────────────────────────────────
   The hero drawing. Three named public sources return what they hold; the
   fifth row is deliberately left OPEN because no source answered it. That open
   row is the honest half of the picture and the reason this figure exists —
   it draws the product's refusal to guess. */
export function FigureSources() {
  const note =
    'Three named public sources return what they hold into your profile. One row stays open because no source answered it, and only you can complete it.';

  return (
    <Figure
      className="ezh-fig-hero"
      note={note}
      caption="Illustrative. Values are shown as blank bars because the real ones are yours — and where no source answered, the profile leaves the row open instead of guessing."
      wide={
        <svg className="ezh-fig-wide" viewBox="0 0 520 372" aria-hidden="true" focusable="false">
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
          <text x="498" y="120" fontSize="14" fill="currentColor" fillOpacity=".55" textAnchor="end">NPI ••• ••• ••••</text>
          <line x1="4" y1="134" x2="516" y2="134" stroke="currentColor" strokeOpacity=".14" />

          <g className="ezh-rowfx" data-r="1">
            <text x="22" y="163" fontSize="15.5" fill="currentColor">Name and specialty</text>
            <rect className="ezh-fig-bar" x="190" y="154" width="104" height="9" rx="4" />
            <text x="498" y="163" fontSize="14" fill="currentColor" fillOpacity=".55" textAnchor="end">NPPES registry</text>
            <line x1="22" y1="180" x2="498" y2="180" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="2">
            <text x="22" y="209" fontSize="15.5" fill="currentColor">Practice location</text>
            <rect className="ezh-fig-bar" x="190" y="200" width="132" height="9" rx="4" />
            <text x="498" y="209" fontSize="14" fill="currentColor" fillOpacity=".55" textAnchor="end">NPPES registry</text>
            <line x1="22" y1="226" x2="498" y2="226" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="3">
            <text x="22" y="255" fontSize="15.5" fill="currentColor">State license record</text>
            <rect className="ezh-fig-bar" x="190" y="246" width="88" height="9" rx="4" />
            <text x="498" y="255" fontSize="14" fill="currentColor" fillOpacity=".55" textAnchor="end">State board</text>
            <line x1="22" y1="272" x2="498" y2="272" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="4">
            <text x="22" y="301" fontSize="15.5" fill="currentColor">Federal exclusion list</text>
            <text x="498" y="301" fontSize="14" fill="currentColor" fillOpacity=".55" textAnchor="end">Checked</text>
            <line x1="22" y1="318" x2="498" y2="318" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="5">
            <rect className="ezh-fig-hot-stroke" x="16" y="330" width="488" height="30" rx="6" fill="none" strokeDasharray="4 3" />
            <text className="ezh-fig-hot-fill" x="22" y="350" fontSize="15.5">Preferred location</text>
            <text className="ezh-fig-hot-fill" x="498" y="350" fontSize="14" textAnchor="end">no source answered — only you can</text>
          </g>
        </svg>
      }
      narrow={
        <svg className="ezh-fig-narrow" viewBox="0 0 330 430" aria-hidden="true" focusable="false">
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
          <text x="176" y="63" fontSize="12" fill="currentColor" fillOpacity=".62">returns what it holds</text>

          <rect x="2" y="84" width="326" height="342" rx="12" fill="none" stroke="currentColor" strokeOpacity=".22" />
          <text x="18" y="110" fontSize="13" fontWeight="600" fill="currentColor">Your profile</text>
          <text x="312" y="110" fontSize="12" fill="currentColor" fillOpacity=".55" textAnchor="end">••• ••• ••••</text>
          <line x1="2" y1="124" x2="328" y2="124" stroke="currentColor" strokeOpacity=".14" />

          <g className="ezh-rowfx" data-r="1">
            <text x="18" y="150" fontSize="13" fill="currentColor">Name and specialty</text>
            <text x="18" y="169" fontSize="12" fill="currentColor" fillOpacity=".55">NPPES registry</text>
            <rect className="ezh-fig-bar" x="200" y="142" width="112" height="9" rx="4" />
            <line x1="18" y1="182" x2="312" y2="182" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="2">
            <text x="18" y="208" fontSize="13" fill="currentColor">Practice location</text>
            <text x="18" y="227" fontSize="12" fill="currentColor" fillOpacity=".55">NPPES registry</text>
            <rect className="ezh-fig-bar" x="200" y="200" width="112" height="9" rx="4" />
            <line x1="18" y1="240" x2="312" y2="240" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="3">
            <text x="18" y="266" fontSize="13" fill="currentColor">State license record</text>
            <text x="18" y="285" fontSize="12" fill="currentColor" fillOpacity=".55">State board record</text>
            <rect className="ezh-fig-bar" x="200" y="258" width="112" height="9" rx="4" />
            <line x1="18" y1="298" x2="312" y2="298" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="4">
            <text x="18" y="324" fontSize="13" fill="currentColor">Federal exclusion list</text>
            <text x="18" y="343" fontSize="12" fill="currentColor" fillOpacity=".55">Checked</text>
            <line x1="18" y1="356" x2="312" y2="356" stroke="currentColor" strokeOpacity=".1" />
          </g>
          <g className="ezh-rowfx" data-r="5">
            <rect className="ezh-fig-hot-stroke" x="12" y="368" width="306" height="46" rx="6" fill="none" strokeDasharray="4 3" />
            <text className="ezh-fig-hot-fill" x="24" y="390" fontSize="13">Preferred location</text>
            <text className="ezh-fig-hot-fill" x="24" y="407" fontSize="12">no source answered — only you can</text>
          </g>
        </svg>
      }
    />
  );
}

/* ── figure 5 — how a match reads ───────────────────────────────────────────
   The Roles section's frame. It draws the SHAPE of a match — two fit lines and
   one named blocker — and never a posting, an employer, or a score. The
   blocker is the point: a role you cannot take says so before you apply. */
export function FigureMatch() {
  const note =
    'Your record is scored against an open role. The match explains itself: two lines fit, one blocker is named before you apply.';

  return (
    <Figure
      note={note}
      caption="Illustrative — the shape of a match, not a real posting or a real employer. Fit lines and blockers are the kind the scoring engine actually returns."
      wide={
        <svg className="ezh-fig-wide" viewBox="0 0 1000 250" aria-hidden="true" focusable="false">
          <rect x="2" y="40" width="230" height="170" rx="10" fill="none" stroke="currentColor" strokeOpacity=".22" />
          <text x="20" y="68" fontSize="13.5" fontWeight="600" fill="currentColor">Your record</text>
          <g className="ezh-fig-bar-g">
            <rect x="20" y="86" width="160" height="9" rx="4" />
            <rect x="20" y="108" width="120" height="9" rx="4" />
            <rect x="20" y="130" width="144" height="9" rx="4" />
          </g>
          <text x="20" y="166" fontSize="12.5" fill="currentColor" fillOpacity=".55">licenses · specialty · sources</text>
          <text x="20" y="196" fontSize="12.5" fill="currentColor" fillOpacity=".55">kept current, not re-typed</text>

          <path className="ezh-fig-hot-stroke" d="M234 124 C 300 124, 310 124, 392 124" fill="none" markerEnd="url(#ezh-arh)" />
          <text className="ezh-fig-hot-fill" x="313" y="110" fontSize="12.5" textAnchor="middle">scored against the record</text>

          <rect x="400" y="20" width="598" height="210" rx="10" fill="none" stroke="currentColor" strokeOpacity=".26" />
          <text x="420" y="48" fontSize="13.5" fontWeight="600" fill="currentColor">An open role</text>
          <g className="ezh-fig-bar-g">
            <rect x="420" y="60" width="200" height="10" rx="4" />
            <rect x="420" y="78" width="130" height="9" rx="4" />
          </g>
          <rect x="420" y="106" width="11" height="11" fill="currentColor" fillOpacity=".5" />
          <text x="442" y="116" fontSize="13.5" fill="currentColor">Your state license covers where the role is</text>
          <rect x="420" y="140" width="11" height="11" fill="currentColor" fillOpacity=".5" />
          <text x="442" y="150" fontSize="13.5" fill="currentColor">Your specialty matches what the role asks for</text>
          <rect className="ezh-fig-hot-stroke" x="420" y="174" width="11" height="11" fill="none" strokeWidth="1.5" />
          <text className="ezh-fig-hot-fill" x="442" y="184" fontSize="13.5">Board certification isn&rsquo;t on your record yet — said up front</text>
          <text x="420" y="214" fontSize="12.5" fill="currentColor" fillOpacity=".55">what lines up and what doesn&rsquo;t, in plain terms</text>
        </svg>
      }
      narrow={
        <svg className="ezh-fig-narrow" viewBox="0 0 330 400" aria-hidden="true" focusable="false">
          <rect x="2" y="2" width="326" height="96" rx="10" fill="none" stroke="currentColor" strokeOpacity=".22" />
          <text x="18" y="28" fontSize="13" fontWeight="600" fill="currentColor">Your record</text>
          <g className="ezh-fig-bar-g">
            <rect x="18" y="44" width="200" height="9" rx="4" />
            <rect x="18" y="62" width="160" height="9" rx="4" />
          </g>
          <text x="18" y="88" fontSize="11.5" fill="currentColor" fillOpacity=".55">licenses · specialty · sources</text>

          <path className="ezh-fig-hot-stroke" d="M164 98 C 164 112, 164 116, 164 132" fill="none" markerEnd="url(#ezh-arh)" />
          <text className="ezh-fig-hot-fill" x="176" y="120" fontSize="11.5">scored against the record</text>

          <rect x="2" y="140" width="326" height="238" rx="10" fill="none" stroke="currentColor" strokeOpacity=".26" />
          <text x="18" y="166" fontSize="13" fontWeight="600" fill="currentColor">An open role</text>
          <g className="ezh-fig-bar-g">
            <rect x="18" y="178" width="180" height="9" rx="4" />
          </g>
          <rect x="18" y="202" width="10" height="10" fill="currentColor" fillOpacity=".5" />
          <text x="36" y="211" fontSize="12" fill="currentColor">Your state license covers the role</text>
          <rect x="18" y="234" width="10" height="10" fill="currentColor" fillOpacity=".5" />
          <text x="36" y="243" fontSize="12" fill="currentColor">Your specialty matches the ask</text>
          <rect className="ezh-fig-hot-stroke" x="18" y="266" width="10" height="10" fill="none" strokeWidth="1.5" />
          <g className="ezh-fig-hot-fill" fontSize="12">
            <text x="36" y="275">Board certification isn&rsquo;t on</text>
            <text x="36" y="292">your record yet — said up front,</text>
            <text x="36" y="309">not after the interview</text>
          </g>
          <g fontSize="11.5" fill="currentColor" fillOpacity=".55">
            <text x="18" y="348">what lines up and what doesn&rsquo;t,</text>
            <text x="18" y="364">in plain terms</text>
          </g>
        </svg>
      }
    />
  );
}

/* ── figure 2 — one owner per item ──────────────────────────────────────────
   The ownership routing. Nothing sits in the middle waiting on nobody: every
   remaining item leaves the stack along exactly one arrow. The employer lane
   stops at "decides" — it never resolves (EC-25 §5). */
export function FigureOwners() {
  const note =
    'Each remaining item routes to exactly one owner: VitalCV, your approval, only you, or the employer.';

  return (
    <Figure
      note={note}
      caption="Illustrative. The point of the drawing is the routing, not the list — nothing is left unassigned."
      wide={
        <svg className="ezh-fig-wide" viewBox="0 0 1000 240" aria-hidden="true" focusable="false">
          <rect x="2" y="62" width="196" height="116" rx="10" fill="none" stroke="currentColor" strokeOpacity=".22" />
          <text x="20" y="90" fontSize="13" fontWeight="600" fill="currentColor">What&rsquo;s left</text>
          <g className="ezh-fig-bar-g">
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
          <text x="252" y="200" fontSize="11.5" fill="currentColor" fillOpacity=".62">exactly one owner</text>
          <rect className="ezh-fig-hot-stroke" x="366" y="14" width="300" height="40" rx="8" fill="none" />
          <g fill="none" stroke="currentColor" strokeOpacity=".26">
            <rect x="366" y="84" width="300" height="40" rx="8" />
            <rect x="366" y="152" width="300" height="40" rx="8" />
            <rect x="366" y="206" width="300" height="40" rx="8" />
          </g>
          <text className="ezh-fig-hot-fill" x="386" y="39" fontSize="13.5" fontWeight="600">VitalCV does it</text>
          <g fontSize="13.5" fill="currentColor">
            <text x="386" y="109">Waits for your approval</text>
            <text x="386" y="177">Only you can do it</text>
            <text x="386" y="231">The employer decides</text>
          </g>
          <g fontSize="11.5" fill="currentColor" fillOpacity=".55">
            <text x="686" y="39">public records, drafts, renewal dates</text>
            <text x="686" y="109">sending your profile, requesting a reference</text>
            <text x="686" y="177">occupational health forms</text>
            <text x="686" y="231">interview and facility sign-off</text>
          </g>
        </svg>
      }
      narrow={
        <svg className="ezh-fig-narrow" viewBox="0 0 330 300" aria-hidden="true" focusable="false">
          <rect x="2" y="2" width="326" height="72" rx="10" fill="none" stroke="currentColor" strokeOpacity=".22" />
          <text x="18" y="26" fontSize="13" fontWeight="600" fill="currentColor">What&rsquo;s left</text>
          <g className="ezh-fig-bar-g">
            <rect x="18" y="38" width="180" height="8" rx="4" />
            <rect x="18" y="52" width="140" height="8" rx="4" />
          </g>
          <g stroke="currentColor" strokeOpacity=".38" fill="none">
            <path d="M60 74 C 60 92, 46 92, 46 108" markerEnd="url(#ezh-ar)" />
            <path d="M130 74 C 130 92, 130 92, 130 108" markerEnd="url(#ezh-ar)" />
            <path d="M200 74 C 200 92, 214 92, 214 108" markerEnd="url(#ezh-ar)" />
            <path d="M270 74 C 270 92, 292 92, 292 108" markerEnd="url(#ezh-ar)" />
          </g>
          {/* 11.5, not the artifact's 11: at the 390px frame this figure renders
              326px wide, so 11 × 326 ÷ 330 = 10.87px effective — under the floor. */}
          <text x="18" y="100" fontSize="11.5" fill="currentColor" fillOpacity=".6">exactly one owner</text>
          <rect className="ezh-fig-hot-stroke" x="2" y="112" width="326" height="40" rx="8" fill="none" />
          <g fill="none" stroke="currentColor" strokeOpacity=".26">
            <rect x="2" y="160" width="326" height="40" rx="8" />
            <rect x="2" y="208" width="326" height="40" rx="8" />
            <rect x="2" y="256" width="326" height="40" rx="8" />
          </g>
          <text className="ezh-fig-hot-fill" x="18" y="137" fontSize="13.5" fontWeight="600">VitalCV does it</text>
          <g fontSize="13.5" fill="currentColor">
            <text x="18" y="185">Waits for your approval</text>
            <text x="18" y="233">Only you can do it</text>
            <text x="18" y="281">The employer decides</text>
          </g>
        </svg>
      }
    />
  );
}

/* ── figure 3 — the approval boundary ───────────────────────────────────────
   Lives on the dark band. The dashed line IS your approval; the complete
   profile never crosses it. The employer's side receives and stops — it never
   resolves green (EC-25 §5). */
export function FigureApproval() {
  const note =
    'Your complete profile stays with you. On approval, a copy carrying only the approved rows crosses to the employer’s review.';

  return (
    <Figure
      note={note}
      caption="Illustrative — no real people, and nothing has been sent."
      wide={
        <svg className="ezh-fig-wide" viewBox="0 0 620 268" aria-hidden="true" focusable="false">
          <rect x="2" y="30" width="212" height="206" rx="10" fill="none" stroke="currentColor" strokeOpacity=".3" />
          <text x="20" y="58" fontSize="14" fontWeight="600" fill="currentColor">Your complete profile</text>
          <g className="ezh-fig-bar-g">
            <rect x="20" y="74" width="172" height="9" rx="4" />
            <rect x="20" y="94" width="140" height="9" rx="4" />
            <rect x="20" y="114" width="164" height="9" rx="4" />
            <rect x="20" y="134" width="120" height="9" rx="4" />
            <rect x="20" y="154" width="152" height="9" rx="4" />
            <rect x="20" y="174" width="136" height="9" rx="4" />
          </g>
          <text x="20" y="212" fontSize="13" fill="currentColor" fillOpacity=".6">stays with you</text>

          <line className="ezh-fig-band-stroke" x1="310" y1="26" x2="310" y2="256" strokeDasharray="5 4" />
          <text className="ezh-fig-band-fill" x="310" y="16" fontSize="13" textAnchor="middle">your approval</text>

          <path className="ezh-fig-band-stroke" d="M214 112 C 262 112, 266 96, 326 96" fill="none" markerEnd="url(#ezh-arb)" />
          <text className="ezh-fig-band-fill" x="302" y="84" fontSize="13" textAnchor="end">approved rows</text>

          <rect x="330" y="52" width="212" height="132" rx="10" fill="none" stroke="currentColor" strokeOpacity=".3" />
          <text x="348" y="80" fontSize="14" fontWeight="600" fill="currentColor">The employer&rsquo;s review</text>
          <g className="ezh-fig-bar-g">
            <rect x="348" y="96" width="150" height="9" rx="4" />
            <rect x="348" y="116" width="120" height="9" rx="4" />
            <rect x="348" y="136" width="138" height="9" rx="4" />
          </g>
          <text x="348" y="170" fontSize="13" fill="currentColor" fillOpacity=".6">they decide, on their timeline</text>
        </svg>
      }
      narrow={
        <svg className="ezh-fig-narrow" viewBox="0 0 330 400" aria-hidden="true" focusable="false">
          <rect x="2" y="2" width="326" height="168" rx="10" fill="none" stroke="currentColor" strokeOpacity=".3" />
          <text x="18" y="28" fontSize="13" fontWeight="600" fill="currentColor">Your complete profile</text>
          <g className="ezh-fig-bar-g">
            <rect x="18" y="44" width="280" height="9" rx="4" />
            <rect x="18" y="64" width="230" height="9" rx="4" />
            <rect x="18" y="84" width="264" height="9" rx="4" />
            <rect x="18" y="104" width="200" height="9" rx="4" />
            <rect x="18" y="124" width="248" height="9" rx="4" />
          </g>
          <text x="18" y="156" fontSize="11.5" fill="currentColor" fillOpacity=".6">stays with you</text>

          <line className="ezh-fig-band-stroke" x1="8" y1="196" x2="322" y2="196" strokeDasharray="5 4" />
          <text className="ezh-fig-band-fill" x="18" y="190" fontSize="11.5">your approval</text>
          <path className="ezh-fig-band-stroke" d="M164 170 C 164 182, 164 184, 164 214" fill="none" markerEnd="url(#ezh-arb)" />
          <text className="ezh-fig-band-fill" x="176" y="214" fontSize="11.5">only approved rows</text>

          <rect x="2" y="230" width="326" height="152" rx="10" fill="none" stroke="currentColor" strokeOpacity=".3" />
          <text x="18" y="256" fontSize="13" fontWeight="600" fill="currentColor">The employer&rsquo;s review</text>
          <g className="ezh-fig-bar-g">
            <rect x="18" y="272" width="240" height="9" rx="4" />
            <rect x="18" y="292" width="190" height="9" rx="4" />
            <rect x="18" y="312" width="216" height="9" rx="4" />
          </g>
          <text x="18" y="350" fontSize="11.5" fill="currentColor" fillOpacity=".6">they decide, on their timeline</text>
        </svg>
      }
    />
  );
}

/* ── figure 4 — reuse ───────────────────────────────────────────────────────
   The thesis in one drawing: one profile, three applications, no rebuild.
   "approved each time" repeats on every branch on purpose — reuse is not
   standing consent. */
export function FigureReuse() {
  const note = 'One profile, built once, feeds each application in turn without being rebuilt.';

  return (
    <Figure
      note={note}
      caption="Illustrative. The drawing shows the reuse, which is the whole point — the profile is not rebuilt for each application."
      wide={
        <svg className="ezh-fig-wide" viewBox="0 0 1000 190" aria-hidden="true" focusable="false">
          <rect className="ezh-fig-hot-stroke" x="2" y="42" width="200" height="106" rx="10" fill="none" />
          <text className="ezh-fig-hot-fill" x="20" y="70" fontSize="13" fontWeight="600">One profile</text>
          <g className="ezh-fig-bar-g">
            <rect x="20" y="86" width="164" height="9" rx="4" />
            <rect x="20" y="104" width="132" height="9" rx="4" />
            <rect x="20" y="122" width="148" height="9" rx="4" />
          </g>
          <g className="ezh-fig-hot-stroke" fill="none">
            <path d="M202 76 C 300 76, 300 46, 396 46" markerEnd="url(#ezh-arh)" />
            <path d="M202 95 C 300 95, 300 95, 396 95" markerEnd="url(#ezh-arh)" />
            <path d="M202 114 C 300 114, 300 144, 396 144" markerEnd="url(#ezh-arh)" />
          </g>
          <text x="238" y="168" fontSize="11.5" fill="currentColor" fillOpacity=".62">reused — never rebuilt</text>
          <g fill="none" stroke="currentColor" strokeOpacity=".26">
            <rect x="402" y="26" width="250" height="40" rx="8" />
            <rect x="402" y="75" width="250" height="40" rx="8" />
            <rect x="402" y="124" width="250" height="40" rx="8" />
          </g>
          <g fontSize="13.5" fill="currentColor">
            <text x="422" y="51">Application — first role</text>
            <text x="422" y="100">Application — next role</text>
            <text x="422" y="149">Application — the one after</text>
          </g>
          <g fontSize="11.5" fill="currentColor" fillOpacity=".55">
            <text x="672" y="51">approved each time</text>
            <text x="672" y="100">approved each time</text>
            <text x="672" y="149">approved each time</text>
          </g>
        </svg>
      }
      narrow={
        <svg className="ezh-fig-narrow" viewBox="0 0 330 316" aria-hidden="true" focusable="false">
          <rect className="ezh-fig-hot-stroke" x="2" y="2" width="326" height="96" rx="10" fill="none" />
          <text className="ezh-fig-hot-fill" x="18" y="28" fontSize="13" fontWeight="600">One profile</text>
          <g className="ezh-fig-bar-g">
            <rect x="18" y="44" width="280" height="9" rx="4" />
            <rect x="18" y="62" width="228" height="9" rx="4" />
            <rect x="18" y="80" width="256" height="9" rx="4" />
          </g>
          <g className="ezh-fig-hot-stroke" fill="none">
            <path d="M70 98 C 70 118, 60 118, 60 136" markerEnd="url(#ezh-arh)" />
            <path d="M164 98 C 164 118, 164 118, 164 136" markerEnd="url(#ezh-arh)" />
            <path d="M258 98 C 258 118, 270 118, 270 136" markerEnd="url(#ezh-arh)" />
          </g>
          {/* 11.5 for the same effective-size reason as the owner figure. */}
          <text x="18" y="130" fontSize="11.5" fill="currentColor" fillOpacity=".6">reused — never rebuilt</text>
          <g fill="none" stroke="currentColor" strokeOpacity=".26">
            <rect x="2" y="140" width="326" height="52" rx="8" />
            <rect x="2" y="200" width="326" height="52" rx="8" />
            <rect x="2" y="260" width="326" height="52" rx="8" />
          </g>
          <g fontSize="13.5" fill="currentColor">
            <text x="18" y="163">Application — first role</text>
            <text x="18" y="223">Application — next role</text>
            <text x="18" y="283">Application — the one after</text>
          </g>
          <g fontSize="11.5" fill="currentColor" fillOpacity=".55">
            <text x="18" y="181">approved each time</text>
            <text x="18" y="241">approved each time</text>
            <text x="18" y="301">approved each time</text>
          </g>
        </svg>
      }
    />
  );
}

/* ── figure 6 — the standing watch ──────────────────────────────────────────
   The founder's second round-4 ruling, drawn: "the idea is for the clinician
   not needing to do anything." Three quiet background ticks, one red
   interruption. The claim stops at watch / refresh / flag — it never becomes a
   credentialing or hiring outcome, which is not VitalCV's to state. */
export function FigureWatch() {
  const note =
    'Your week runs unchanged while VitalCV watches renewal dates and refreshes the record in the background. The one marked moment is the only time you are needed.';

  return (
    <Figure
      note={note}
      caption="Illustrative — the cadence, not a log. Quiet is the default; the one marked moment is the only time you’re needed."
      wide={
        <svg className="ezh-fig-wide" viewBox="0 0 1000 200" aria-hidden="true" focusable="false">
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
            <text x="430" y="172">record refreshed — NPPES</text>
            <text x="660" y="172">quiet — nothing changed</text>
          </g>

          <line className="ezh-fig-hot-stroke" x1="870" y1="145" x2="870" y2="131" strokeWidth="1.5" />
          <text className="ezh-fig-hot-fill" x="870" y="172" fontSize="12.5" textAnchor="middle">needs you: one approval</text>
          <path className="ezh-fig-hot-stroke" d="M870 128 C 870 96, 870 84, 870 52" fill="none" markerEnd="url(#ezh-arh)" />
          <text className="ezh-fig-hot-fill" x="858" y="92" fontSize="12.5" textAnchor="end">the only interruption</text>
        </svg>
      }
      narrow={
        <svg className="ezh-fig-narrow" viewBox="0 0 330 330" aria-hidden="true" focusable="false">
          <text x="52" y="28" fontSize="11.5" fill="currentColor" fillOpacity=".55">VitalCV, in the background</text>
          <line x1="30" y1="20" x2="30" y2="310" stroke="currentColor" strokeOpacity=".3" />
          <g stroke="currentColor" strokeOpacity=".45" strokeWidth="1.5">
            <line x1="30" y1="60" x2="44" y2="60" />
            <line x1="30" y1="120" x2="44" y2="120" />
            <line x1="30" y1="180" x2="44" y2="180" />
          </g>
          <g fontSize="12" fill="currentColor">
            <text x="52" y="64">renewal dates watched</text>
            <text x="52" y="124">record refreshed — NPPES</text>
            <text x="52" y="184">quiet — nothing changed</text>
          </g>
          <line className="ezh-fig-hot-stroke" x1="30" y1="250" x2="44" y2="250" strokeWidth="1.5" />
          <g className="ezh-fig-hot-fill" fontSize="12">
            <text x="52" y="254">needs you: one approval</text>
            <text x="52" y="272">the only interruption</text>
          </g>
        </svg>
      }
    />
  );
}
