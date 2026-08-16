'use client';

/**
 * EmployerLedger — the v4 employer section (amendment F): four numbered
 * claims and an illustrative requirement ledger.
 *
 * Corrections to the founder's v4 file, disclosed in amendment F: the ledger
 * names no employer (the file carried "Meridian Health"), its rows are the
 * REAL registry lanes with blank bars for values, and the OIG row does not
 * depict a "no match returned" response that never occurred (EC-25.2). The
 * scene stops at review: the employer keeps the decision, and nothing here
 * resolves one.
 */

import Link from 'next/link';

import { StateStamp } from '@/components/home/easy/stateVocabulary';
import { FUNNEL_EVENTS, trackFunnelEvent } from '@/lib/analytics/funnel';

export default function EmployerLedger() {
  return (
    <section id="employers" className="ezh-emp-sec" data-header-theme="light" data-ezh-reveal="" aria-labelledby="ezh-emp-h">
      <div className="ezh-wrap">
        <div className="ezh-sec-head">
          <div>
            <span className="ezh-k">For employers</span>
            <h2 id="ezh-emp-h">
              Start clinicians <em className="ezh-accent-word">from evidence</em>, not from
              scratch.
            </h2>
          </div>
          <p className="ezh-sec-lede">
            A consented exact packet, the requirements it already speaks to, and the open items
            that remain. Your team reviews exceptions instead of chasing documents &mdash; and
            every decision stays yours.
          </p>
        </div>

        <div className="ezh-emp-grid">
          <ol className="ezh-emp-list">
            <li>
              <span className="ezh-k ezh-emp-idx">01</span>
              <div>
                <h3>Arrive with the evidence attached</h3>
                <p>
                  The candidate consents to an exact packet before your first conversation.
                  Nothing arrives that they did not release.
                </p>
              </div>
            </li>
            <li>
              <span className="ezh-k ezh-emp-idx">02</span>
              <div>
                <h3>Read requirements as a ledger</h3>
                <p>
                  Each requirement resolves to a source and a cadence. Unread rows are shown as
                  unread, not as pending optimism.
                </p>
              </div>
            </li>
            <li>
              <span className="ezh-k ezh-emp-idx">03</span>
              <div>
                <h3>Work the exceptions</h3>
                <p>
                  The open items are named, each with an owner. That is the queue &mdash; not a
                  folder of eighteen PDFs.
                </p>
              </div>
            </li>
            <li>
              <span className="ezh-k ezh-emp-idx">04</span>
              <div>
                <h3>Keep the decision</h3>
                <p>
                  VitalCV never returns a verdict on a person. It returns what sources said and
                  when they said it &mdash; institution review decides the rest.
                </p>
              </div>
            </li>
          </ol>

          <div className="ezh-emp-panel" data-home-figure="requirement-ledger">
            <span className="ezh-k">Requirement ledger &middot; illustrative, no real role</span>
            <ul className="ezh-ledger ezh-emp-ledger">
              <li className="ezh-lrow is-confirmed">
                <div className="ezh-lrow-main">
                  <span className="ezh-lrow-claim">Identity matches the registry record</span>
                  <span className="ezh-lrow-bar" aria-hidden="true" />
                  <span className="ezh-lrow-src">NPPES · read live</span>
                </div>
                <StateStamp state="confirmed">Source-confirmed</StateStamp>
              </li>
              <li className="ezh-lrow is-snapshot">
                <div className="ezh-lrow-main">
                  <span className="ezh-lrow-claim">Exclusion screen on file</span>
                  <span className="ezh-lrow-bar" aria-hidden="true" />
                  <span className="ezh-lrow-src">OIG LEIE · monthly file, date printed</span>
                </div>
                <StateStamp state="snapshot">Monthly snapshot</StateStamp>
              </li>
              <li className="ezh-lrow is-snapshot">
                <div className="ezh-lrow-main">
                  <span className="ezh-lrow-claim">Medicare enrollment on file</span>
                  <span className="ezh-lrow-bar" aria-hidden="true" />
                  <span className="ezh-lrow-src">PECOS · quarterly file, date printed</span>
                </div>
                <StateStamp state="snapshot">Quarterly snapshot</StateStamp>
              </li>
              <li className="ezh-lrow is-access">
                <div className="ezh-lrow-main">
                  <span className="ezh-lrow-claim">State licensure</span>
                  <span className="ezh-lrow-src">Only the clinician can open this source</span>
                </div>
                <StateStamp state="access">Access required</StateStamp>
              </li>
              <li className="ezh-lrow is-attention">
                <div className="ezh-lrow-main">
                  <span className="ezh-lrow-claim">One named item, owned</span>
                  <span className="ezh-lrow-bar" aria-hidden="true" />
                  <span className="ezh-lrow-src">Owner shown on the row · stays open until real</span>
                </div>
                <StateStamp state="attention">Needs the clinician</StateStamp>
              </li>
            </ul>
            <div className="ezh-emp-actions">
              <Link className="ezh-action" href="/pilot">
                Request a pilot
              </Link>
              <Link
                className="ezh-quiet-link"
                href="/employers"
                data-home-employer-cta=""
                onClick={() => trackFunnelEvent(FUNNEL_EVENTS.EMPLOYER_ENTRY_CLICKED)}
              >
                VitalCV for employers <span aria-hidden="true">&#8627;</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
