/**
 * ArcBeats — the v4 five-beat arc (amendment F): one record, once — then
 * every job after it.
 *
 * Record → readiness → roles → apply with proof → start. Each beat carries a
 * small evidence-geometry figure and one state stamp. Corrections to the
 * founder's v4 file, disclosed in amendment F: "wallet" is "record"
 * everywhere (EC-9 / C1); the beat fragments carry no fabricated counts,
 * dates, packet ids or eligibility numbers (EC-25.3 — the file had
 * "Confirmed · 3 lanes", "4 roles eligible today", "PKT-2026-0810-4C71",
 * "target start 2026-08-24"); the axis's "Days, not months" is a retired
 * unmeasured time-to-start claim and renders as "Days" beside the arc's own
 * honesty note, which is kept: durations are pilot targets, not returned
 * data.
 *
 * The figures are static drawings; the beats' meaning lives in the copy.
 */

import { StateStamp } from '@/components/home/easy/stateVocabulary';

export default function ArcBeats() {
  return (
    <section id="arc" className="ezh-arc-sec" data-home-arc="" data-header-theme="light" data-ezh-reveal="" aria-labelledby="ezh-arc-h">
      <div className="ezh-wrap">
        <div className="ezh-sec-head">
          <div>
            <span className="ezh-k">Record to start date</span>
            <h2 id="ezh-arc-h">
              One record, once &mdash; then <em className="ezh-accent-word">every job after it</em>.
            </h2>
          </div>
          <p className="ezh-sec-lede">
            You assemble your evidence a single time and keep it for the rest of your career.
            Everything downstream &mdash; what fits you, what you apply with, how your next
            employer starts &mdash; runs off that one record instead of asking you again.
          </p>
        </div>

        <ol className="ezh-arc" data-home-figure="arc-beats">
          <li className="ezh-beat">
            <figure className="ezh-beat-fig" aria-hidden="true">
              <svg viewBox="0 0 150 78" focusable="false">
                <rect className="ezh-f-field" x="4" y="6" width="50" height="13" rx="3" />
                <rect className="ezh-f-paper" x="4" y="18" width="124" height="54" rx="3" />
                <rect className="ezh-f-bar" x="15" y="29" width="88" height="7" rx="3.5" />
                <rect className="ezh-f-bar" x="15" y="43" width="70" height="7" rx="3.5" />
                <rect className="ezh-f-bar is-acc" x="15" y="57" width="54" height="7" rx="3.5" />
                <text className="ezh-f-g is-confirmed" x="112" y="37">●</text>
              </svg>
            </figure>
            <span className="ezh-k ezh-beat-stage">Once, and for good</span>
            <h3>The record</h3>
            <p>
              Ten digits open it. Sources fill it, you own it, and it outlives every employer
              you&rsquo;ll ever have.
            </p>
            <div className="ezh-beat-frag">
              <StateStamp state="confirmed">Source-confirmed rows build it</StateStamp>
              <span className="ezh-data">NPI ··· ··· ····</span>
            </div>
          </li>

          <li className="ezh-beat">
            <figure className="ezh-beat-fig" aria-hidden="true">
              <svg viewBox="0 0 150 78" focusable="false">
                <rect className="ezh-f-tile" x="3" y="6" width="124" height="16" rx="3" />
                <rect className="ezh-f-tile" x="3" y="28" width="124" height="16" rx="3" />
                <rect className="ezh-f-tile" x="3" y="50" width="124" height="16" rx="3" />
                <rect className="ezh-f-bar" x="30" y="11" width="66" height="5" rx="2.5" />
                <rect className="ezh-f-bar" x="30" y="33" width="48" height="5" rx="2.5" />
                <rect className="ezh-f-bar" x="30" y="55" width="58" height="5" rx="2.5" />
                <text className="ezh-f-g is-confirmed" x="10" y="19">●</text>
                <text className="ezh-f-g is-attention" x="10" y="41">▲</text>
                <text className="ezh-f-g is-attention" x="10" y="63">▲</text>
              </svg>
            </figure>
            <span className="ezh-k ezh-beat-stage">Continuously</span>
            <h3>Readiness</h3>
            <p>
              You see what would have stalled you in week three &mdash; before anyone asks for
              it, while it is still yours to fix.
            </p>
            <div className="ezh-beat-frag">
              <StateStamp state="attention">Needs you &middot; named, with an owner</StateStamp>
              <span className="ezh-data">re-read on file · no re-upload</span>
            </div>
          </li>

          <li className="ezh-beat">
            <figure className="ezh-beat-fig" aria-hidden="true">
              <svg viewBox="0 0 150 78" focusable="false">
                <rect className="ezh-f-bar" x="2" y="12" width="44" height="9" rx="3" />
                <rect className="ezh-f-bar" x="2" y="34" width="44" height="9" rx="3" />
                <rect className="ezh-f-bar" x="2" y="56" width="44" height="9" rx="3" />
                <rect className="ezh-f-tile is-wash" x="98" y="8" width="48" height="16" rx="3" />
                <rect className="ezh-f-tile" x="98" y="31" width="48" height="16" rx="3" />
                <rect className="ezh-f-tile is-wash" x="98" y="54" width="48" height="16" rx="3" />
                <path className="ezh-f-link is-acc" d="M48 16 H96" />
                <path className="ezh-f-link is-acc" d="M48 61 H96" />
              </svg>
            </figure>
            <span className="ezh-k ezh-beat-stage">When you&rsquo;re looking</span>
            <h3>Roles that fit the evidence</h3>
            <p>
              Matching starts from what your record already shows &mdash; license state, setting,
              the work itself &mdash; not from keywords in a r&eacute;sum&eacute;. The live feed
              below is that surface.
            </p>
            <div className="ezh-beat-frag">
              <StateStamp state="snapshot">Matched against the record</StateStamp>
              <span className="ezh-data">current listings · source named</span>
            </div>
          </li>

          <li className="ezh-beat">
            <figure className="ezh-beat-fig" aria-hidden="true">
              <svg viewBox="0 0 150 78" focusable="false">
                <path className="ezh-f-link is-acc" d="M34 39 H142" />
                <path className="ezh-f-gate" d="M80 8 V30" />
                <path className="ezh-f-gate" d="M80 48 V70" />
                <rect className="ezh-f-tile" x="6" y="22" width="28" height="34" rx="3" />
                <rect className="ezh-f-bar" x="11" y="29" width="17" height="4" rx="2" />
                <rect className="ezh-f-bar" x="11" y="37" width="13" height="4" rx="2" />
                <rect className="ezh-f-bar is-acc" x="11" y="45" width="10" height="4" rx="2" />
                <rect className="ezh-f-tile is-wash" x="108" y="24" width="34" height="30" rx="3" />
                <text className="ezh-f-g is-confirmed" x="113" y="44">●</text>
                <text className="ezh-f-lbl" x="6" y="74">only you open it</text>
              </svg>
            </figure>
            <span className="ezh-k ezh-beat-stage">On your consent</span>
            <h3>Apply with proof attached</h3>
            <p>
              One exact packet goes with the application &mdash; you choose its scope, and
              nothing moves without you. No portal re-typing, no folder.
            </p>
            <div className="ezh-beat-frag">
              <StateStamp state="confirmed">Released by you</StateStamp>
              <span className="ezh-data">scope printed on it</span>
            </div>
          </li>

          <li className="ezh-beat">
            <figure className="ezh-beat-fig" aria-hidden="true">
              <svg viewBox="0 0 150 78" focusable="false">
                <rect className="ezh-f-field" x="3" y="16" width="16" height="16" rx="2" />
                <rect className="ezh-f-field" x="23" y="16" width="16" height="16" rx="2" />
                <rect className="ezh-f-field" x="43" y="16" width="16" height="16" rx="2" />
                <rect className="ezh-f-field" x="63" y="16" width="16" height="16" rx="2" />
                <rect className="ezh-f-tile is-wash" x="83" y="16" width="16" height="16" rx="2" />
                <rect className="ezh-f-field" x="103" y="16" width="16" height="16" rx="2" />
                <rect className="ezh-f-field" x="123" y="16" width="16" height="16" rx="2" />
                <path className="ezh-f-hair" d="M3 44 H139" />
                <text className="ezh-f-lbl" x="3" y="62">target start</text>
                <rect className="ezh-f-bar" x="83" y="54" width="40" height="7" rx="3.5" />
              </svg>
            </figure>
            <span className="ezh-k ezh-beat-stage">Day one</span>
            <h3>Start in days</h3>
            <p>
              The employer begins at exceptions, not at intake &mdash; a short list of named
              items instead of a paper chase.
            </p>
            <div className="ezh-beat-frag">
              <StateStamp state="attention">Open items stay visibly open</StateStamp>
              <span className="ezh-data">each with an owner</span>
            </div>
          </li>
        </ol>

        <div className="ezh-axis" aria-hidden="true">
          <span>Minutes</span>
          <span>Ongoing</span>
          <span>Same week</span>
          <span>On release</span>
          <span className="is-acc">Days</span>
        </div>
        <div className="ezh-arc-note">
          <p>
            The loop only holds because the record is the clinician&rsquo;s. Every arrow above
            moves a reading, never a copy of a document.
          </p>
          <span className="ezh-k" data-home-duration-note="">
            Durations are pilot targets, not returned data
          </span>
        </div>
      </div>
    </section>
  );
}
