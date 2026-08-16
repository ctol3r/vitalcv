/**
 * StandingWatch — the founder's second round-4 ruling, drawn and stated:
 * *"the idea is for the clinician not needing to do anything. vitalcv keeps the
 * clinician updated and ready to get hired and start seeing patients"*
 * (constitution amendment E, Composition additions row).
 *
 * The amendment binds how far this claim may go: the thesis is "stated to the
 * limit of what the product truthfully does (watch, refresh, flag), **never as
 * a credentialing outcome**".
 *
 * So the section claims three verbs and stops. VitalCV watches renewal dates,
 * refreshes the record from its named public sources, and says something when
 * a person is genuinely needed. It does not claim the clinician gets hired,
 * gets credentialed, gets cleared, or starts — those are the employer's
 * decisions and the truth contract's line (EC-25 §5, §6).
 *
 * One deliberate departure from the committed artifact: its closing sentence
 * read "…and hiring starts from there instead of from a pile of forms." That
 * is a claim about how an employer's hiring proceeds, which is exactly the
 * outcome edge the amendment forbids. The record-side half of the sentence is
 * kept; the hiring half is not. Recorded in the recomposition PR.
 *
 * Nothing here is interactive: the figure is static art and the copy is fixed.
 * It rides into the client bundle with its parent, EasyHome.
 */

import { FigureWatch } from '@/components/home/easy/HomeFigures';

export default function StandingWatch() {
  return (
    <section
      className="ezh-watch"
      data-home-standing-watch=""
      data-header-theme="light"
      aria-labelledby="ezh-watch-h"
    >
      <div className="ezh-wrap">
        <span className="ezh-k">While you work</span>
        <h2 id="ezh-watch-h">Most weeks, you do nothing.</h2>
        <p className="ezh-sec-p">
          VitalCV watches renewal dates, refreshes your record from its public sources, and stays
          quiet while nothing changes. When something genuinely needs you &mdash; an approval, a
          signature, an expiring license &mdash; it says so plainly, once. So when the right role
          opens, your record is already today&rsquo;s, instead of a pile of forms away.
        </p>

        <FigureWatch />
      </div>
    </section>
  );
}
