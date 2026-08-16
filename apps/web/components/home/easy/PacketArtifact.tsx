/**
 * PacketArtifact — the v4 shared-record artifact section (amendment F): the
 * shape of what an employer receives, and what it refuses to decide.
 *
 * Explicitly ILLUSTRATIVE, by standing law: packet receipts ship dark and no
 * public packet exists to show, so — corrections to the founder's v4 file,
 * disclosed in amendment F — the intro no longer claims "a real proof
 * packet"; the ids, sha256 hash, verify-URL, recipient name, timestamps and
 * "no match returned" fixture are gone; every value is a blank bar; the
 * findings rows are the REAL registry lanes in states the product produces;
 * and the caption says what this is: the shape of a packet, not a real
 * submission. The founder's "Open a real public packet" control pointed at
 * nothing real and is replaced by the honest public surface, /verify.
 *
 * The state legend teaches FIVE states, no others — the founder file's sixth
 * row ("Adverse · under dispute") taught a state the product cannot produce
 * and is dropped (standing rule; disclosed).
 */

import Link from 'next/link';

import { StateStamp } from '@/components/home/easy/stateVocabulary';

function BlankBar({ wide }: { wide?: boolean }) {
  return <span className={`ezh-blankbar${wide ? ' is-wide' : ''}`} aria-hidden="true" />;
}

export default function PacketArtifact() {
  return (
    <section id="packet" className="ezh-pkt-sec" data-header-theme="light" data-ezh-reveal="" aria-labelledby="ezh-pkt-h">
      <div className="ezh-wrap">
        <div className="ezh-sec-head">
          <div>
            <span className="ezh-k">What you share</span>
            <h2 id="ezh-pkt-h">
              One exact packet &mdash; and <em className="ezh-accent-word">what it refuses</em> to
              decide.
            </h2>
          </div>
          <p className="ezh-sec-lede">
            When you apply, the employer receives a bounded, printed thing: sources, scope, and
            an explicit statement of the questions it does not answer. A reviewer can read it in
            a minute. This is its shape &mdash; it is not a real submission.
          </p>
        </div>

        <div className="ezh-pkt-grid">
          <article className="ezh-pkt" data-home-figure="packet-shape" aria-label="Illustrative — the shape of an exact packet, with blank bars where a real one carries values.">
            <div className="ezh-pkt-top">
              <div>
                <h3>Exact packet &mdash; career evidence</h3>
                <span className="ezh-data ezh-pkt-id">composed on your release · scope chosen by you</span>
              </div>
              <StateStamp state="snapshot">True as of its file dates</StateStamp>
            </div>

            <dl className="ezh-pkt-meta">
              <div>
                <dt>Subject</dt>
                <dd className="ezh-data">NPI ··· ··· ····</dd>
              </div>
              <div>
                <dt>Recipient</dt>
                <dd><BlankBar /> <span className="ezh-pkt-meta-note">named by you</span></dd>
              </div>
              <div>
                <dt>Scope</dt>
                <dd><BlankBar wide /> <span className="ezh-pkt-meta-note">chosen by you</span></dd>
              </div>
              <div>
                <dt>Excluded</dt>
                <dd><BlankBar /> <span className="ezh-pkt-meta-note">everything else</span></dd>
              </div>
            </dl>

            <div className="ezh-pkt-body">
              <span className="ezh-k">Findings, as a source returned them</span>
              <ul className="ezh-ledger ezh-pkt-ledger">
                <li className="ezh-lrow is-confirmed">
                  <div className="ezh-lrow-main">
                    <span className="ezh-lrow-claim">NPI registry record</span>
                    <span className="ezh-lrow-bar" aria-hidden="true" />
                    <span className="ezh-lrow-src">NPPES · read live</span>
                  </div>
                  <StateStamp state="confirmed">Source-confirmed</StateStamp>
                </li>
                <li className="ezh-lrow is-snapshot">
                  <div className="ezh-lrow-main">
                    <span className="ezh-lrow-claim">Exclusion screen</span>
                    <span className="ezh-lrow-bar" aria-hidden="true" />
                    <span className="ezh-lrow-src">OIG LEIE · monthly file, date printed</span>
                  </div>
                  <StateStamp state="snapshot">Monthly snapshot</StateStamp>
                </li>
                <li className="ezh-lrow is-snapshot">
                  <div className="ezh-lrow-main">
                    <span className="ezh-lrow-claim">Medicare enrollment</span>
                    <span className="ezh-lrow-bar" aria-hidden="true" />
                    <span className="ezh-lrow-src">PECOS · quarterly file, date printed</span>
                  </div>
                  <StateStamp state="snapshot">Quarterly snapshot</StateStamp>
                </li>
                <li className="ezh-lrow is-access">
                  <div className="ezh-lrow-main">
                    <span className="ezh-lrow-claim">State licensure</span>
                    <span className="ezh-lrow-src">Not read &mdash; access required, and the row says so</span>
                  </div>
                  <StateStamp state="access">Access required</StateStamp>
                </li>
                <li className="ezh-lrow is-unchecked">
                  <div className="ezh-lrow-main">
                    <span className="ezh-lrow-claim">Employment history</span>
                    <span className="ezh-lrow-src">No source queried &mdash; needs an issuer to attest</span>
                  </div>
                  <StateStamp state="unchecked">Not checked</StateStamp>
                </li>
              </ul>
            </div>

            <div className="ezh-pkt-not">
              <span className="ezh-k">What this exact packet does not decide</span>
              <ul>
                <li>
                  <s aria-hidden="true">&mdash;</s>
                  <span>
                    Whether this clinician should be hired, privileged, or enrolled. That
                    authority stays with the reviewing organisation.
                  </span>
                </li>
                <li>
                  <s aria-hidden="true">&mdash;</s>
                  <span>
                    Anything about the rows marked <em>access required</em> or{' '}
                    <em>not checked</em>. Absence of a finding is not a finding.
                  </span>
                </li>
                <li>
                  <s aria-hidden="true">&mdash;</s>
                  <span>
                    That a monthly or quarterly row is true <em>today</em> &mdash; those are
                    dated files, and the date is printed on the row.
                  </span>
                </li>
              </ul>
            </div>

            <div className="ezh-pkt-foot">
              <span className="ezh-data">Illustrative &mdash; the shape of an exact packet. This is not a real submission.</span>
              <span className="ezh-data">Page 1 of 1</span>
            </div>
          </article>

          <div className="ezh-pkt-side">
            <div>
              <span className="ezh-k">Read it the way a reviewer does</span>
              <p className="ezh-pkt-side-note">
                Machine facts are set in mono, prose in sans. If you are looking at mono type, a
                source returned it &mdash; VitalCV did not write it.
              </p>
            </div>

            <div className="ezh-legend" data-home-state-legend="">
              <span className="ezh-k">Five states, no others</span>
              <div className="ezh-legend-list">
                <StateStamp state="confirmed">Source-confirmed &middot; a named source answered</StateStamp>
                <StateStamp state="snapshot">Snapshot &middot; true as of a dated monthly or quarterly file</StateStamp>
                <StateStamp state="attention">Needs you &middot; yours to act</StateStamp>
                <StateStamp state="access">Access required &middot; we can&rsquo;t look</StateStamp>
                <StateStamp state="unchecked">Not checked &middot; the default</StateStamp>
              </div>
              <p className="ezh-legend-note">
                The word is always ink. The hue only ever carries the glyph and the left rule.
              </p>
            </div>

            <Link className="ezh-quiet-link" href="/verify">
              Check a public record yourself <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
