/**
 * Roles — the answer to the founder's round-4 question, *"why isnt job
 * opportunities mentioned once on homepage??"* (constitution amendment E,
 * Composition additions row).
 *
 * The amendment specifies this section as "the live opportunity feed framed by
 * the match-explanation figure". The framing and the feed are deliberately two
 * adjacent siblings rather than one component: `OpportunityHorizon` carries the
 * D.1 opportunity truth contract — honest SSR pending state, source labels,
 * observation times, the external-vs-integrated application boundary, and the
 * refusal to substitute illustrative jobs when the feed is empty — and the
 * amendment leaves those rows unchanged. Wrapping it would have meant editing
 * it. This frames it instead, and the CSS joins the two into one visual
 * section.
 *
 * The figure draws the SHAPE of a match and never a real posting, employer, or
 * score (EC-25 §3). The copy is the founder-approved #1267 wording.
 *
 * Nothing here is interactive or stateful — it is static markup plus one
 * inline-SVG figure. It is pulled into the client bundle only because its
 * parent EasyHome is a client component, not because it needs to be.
 */

import { FigureMatch } from '@/components/home/easy/HomeFigures';

export default function Roles() {
  return (
    <section
      className="ezh-roles"
      data-home-roles=""
      data-header-theme="light"
      aria-labelledby="ezh-roles-h"
    >
      <div className="ezh-wrap">
        <span className="ezh-k">Roles</span>
        <h2 id="ezh-roles-h">A job board that reads your credentials, not your keywords.</h2>
        <p className="ezh-sec-p">
          Most boards match the words on your r&eacute;sum&eacute;. VitalCV scores a role against
          what your record already shows &mdash; and names what stands between you and it, before
          you apply. When nothing fits, it says nothing fits instead of padding the list.
        </p>

        <FigureMatch />

        <div className="ezh-beats ezh-beats-three">
          <div className="ezh-beat">
            <b>Scored on your record</b>
            <span>
              Your NPPES profile, licenses, and specialty &mdash; not the keywords you remembered
              to put in a document.
            </span>
          </div>
          <div className="ezh-beat">
            <b>Every match explains itself</b>
            <span>
              What lines up and what doesn&rsquo;t, in plain terms. Not a percentage you
              can&rsquo;t argue with.
            </span>
          </div>
          <div className="ezh-beat">
            <b>Blockers before you apply</b>
            <span>
              A role that needs a license you don&rsquo;t hold says so up front &mdash; not after
              the interview.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
