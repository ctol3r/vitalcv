/**
 * TrustFlowFigure — the v4 four-hop trust-flow diagram (amendment F).
 *
 * What a source returned → where it rests → the gate only you open → the desk
 * where a human still decides. One lane stops at a barred rule: a source we
 * are not allowed to read, drawn that way on purpose.
 *
 * Corrections to the founder's v4 file under standing law, disclosed in
 * amendment F: the sources are the REAL registry lanes (the founder file
 * named ABMS — not integrated — and NPDB, which EC-3 bans as a customer
 * noun); the NPI is masked; all fixture timestamps and dates are gone;
 * values are blank bars; the employer queue names no clinician item that a
 * source never produced, and its "satisfied" rows are blank bars rather than
 * counts (EC-25.3).
 *
 * Static by design: the founder file animated packet-travel and link dashes
 * on infinite loops; EC-29 permits no decorative loop, and a single-shot
 * travel adds nothing a still drawing does not. The barred lane and the gate
 * carry the meaning, and the adjacent transcript carries it without the art.
 */

const TRANSCRIPT =
  'Named sources return readings into the record the clinician owns: the NPPES registry reads live, the OIG exclusion file is a monthly snapshot, and state licensure stops at a barred rule because VitalCV may not read it. A consent gate that only the clinician opens releases one exact packet to an employer, whose reviewers work a short exceptions queue. The decision stays with the employer.';

export default function TrustFlowFigure() {
  return (
    <figure
      className="ezh-fig ezh-fig-flow"
      data-home-figure="trust-flow"
      data-visual-material="drawn-ink"
      aria-label="Diagram: named sources return readings into the clinician's record; a consent gate only the clinician opens releases one exact packet to an employer's exceptions queue; the state-licensure source stops at a barred rule because it cannot be read."
    >
      <div className="ezh-fig-art" aria-hidden="true">
        {/* wide variant */}
        <svg className="ezh-fig-wide" viewBox="0 0 960 336" focusable="false">
          <text className="ezh-f-lbl" x="0" y="16">01 · Named sources</text>
          <g>
            <rect className="ezh-f-paper" x="0" y="30" width="204" height="62" rx="3" />
            <text className="ezh-f-val" x="16" y="56">NPPES registry</text>
            <text className="ezh-f-mut" x="16" y="76">read live</text>
            <text className="ezh-f-g is-confirmed" x="182" y="60">●</text>
          </g>
          <g>
            <rect className="ezh-f-paper" x="0" y="104" width="204" height="62" rx="3" />
            <text className="ezh-f-val" x="16" y="130">OIG exclusion file</text>
            <text className="ezh-f-mut" x="16" y="150">monthly snapshot</text>
            <text className="ezh-f-g is-snapshot" x="182" y="134">◐</text>
          </g>
          <g>
            <rect className="ezh-f-paper" x="0" y="178" width="204" height="62" rx="3" />
            <text className="ezh-f-val" x="16" y="204">State licensure</text>
            <text className="ezh-f-mut" x="16" y="224">not readable by VitalCV</text>
            <text className="ezh-f-g is-access" x="182" y="208">⊘</text>
          </g>
          <path className="ezh-f-link is-acc" d="M204 61 C252 61 256 108 304 108" />
          <path className="ezh-f-link is-acc" d="M204 135 C252 135 256 154 304 154" />
          <path className="ezh-f-link" d="M204 209 H252" />
          <path className="ezh-f-gate" d="M258 192 V226" />
          <text className="ezh-f-lbl" x="296" y="250" textAnchor="end">only you can open it</text>

          <text className="ezh-f-lbl" x="304" y="16">02 · Your record, for life</text>
          <rect className="ezh-f-field" x="304" y="30" width="112" height="18" rx="3" />
          <rect className="ezh-f-paper" x="304" y="48" width="256" height="228" rx="3" />
          <text className="ezh-f-data" x="320" y="72">NPI ··· ··· ····</text>
          <path className="ezh-f-hair" d="M320 82 H544" />
          <g>
            <rect className="ezh-f-tile" x="320" y="94" width="224" height="40" rx="3" />
            <text className="ezh-f-g is-confirmed" x="334" y="119">●</text>
            <text className="ezh-f-val" x="352" y="112">Identity</text>
            <rect className="ezh-f-bar" x="352" y="120" width="88" height="7" rx="3.5" />
          </g>
          <g>
            <rect className="ezh-f-tile" x="320" y="142" width="224" height="40" rx="3" />
            <text className="ezh-f-g is-snapshot" x="334" y="167">◐</text>
            <text className="ezh-f-val" x="352" y="160">Exclusion screen</text>
            <rect className="ezh-f-bar" x="352" y="168" width="64" height="7" rx="3.5" />
          </g>
          <g>
            <rect className="ezh-f-tile is-open" x="320" y="190" width="224" height="40" rx="3" />
            <text className="ezh-f-g is-access" x="334" y="215">⊘</text>
            <text className="ezh-f-val" x="352" y="208">Licensure</text>
            <text className="ezh-f-mut" x="352" y="223">access-gated</text>
          </g>
          <g>
            <rect className="ezh-f-tile is-open" x="320" y="238" width="224" height="30" rx="3" />
            <text className="ezh-f-g is-unchecked" x="334" y="258">○</text>
            <text className="ezh-f-mut" x="352" y="258">rows not yet checked stay open</text>
          </g>

          <text className="ezh-f-lbl" x="612" y="16" textAnchor="middle">03 · Consent</text>
          <path className="ezh-f-gate" d="M612 40 V136" />
          <path className="ezh-f-gate" d="M612 176 V272" />
          <path className="ezh-f-link is-acc" d="M560 156 H660" />
          <rect
            className="ezh-f-pktdot"
            x="576"
            y="150"
            width="11"
            height="11"
            rx="2"
            style={{ ['--ezh-tx' as never]: '78px' }}
          />
          <text className="ezh-f-lbl" x="612" y="296" textAnchor="middle">one exact packet</text>

          <text className="ezh-f-lbl" x="660" y="16">04 · Employer review</text>
          <rect className="ezh-f-paper" x="660" y="48" width="300" height="228" rx="3" />
          <text className="ezh-f-val" x="676" y="74">Exceptions queue · not a folder</text>
          <path className="ezh-f-hair" d="M676 86 H944" />
          <g>
            <rect className="ezh-f-tile" x="676" y="98" width="268" height="40" rx="3" />
            <text className="ezh-f-g is-attention" x="690" y="123">▲</text>
            <text className="ezh-f-val" x="710" y="116">One named item open</text>
            <text className="ezh-f-mut" x="710" y="131">owner: the clinician</text>
          </g>
          <g>
            <rect className="ezh-f-tile" x="676" y="146" width="268" height="40" rx="3" />
            <text className="ezh-f-g is-access" x="690" y="171">⊘</text>
            <text className="ezh-f-val" x="710" y="164">A source only you can open</text>
            <text className="ezh-f-mut" x="710" y="179">owner: the clinician</text>
          </g>
          <g>
            <rect className="ezh-f-tile is-wash" x="676" y="194" width="268" height="40" rx="3" />
            <text className="ezh-f-val" x="690" y="212">Everything else, source-backed</text>
            <rect className="ezh-f-bar" x="690" y="220" width="128" height="7" rx="3.5" />
          </g>
          <text className="ezh-f-lbl" x="676" y="260">the decision stays with the employer</text>
        </svg>

        {/* narrow variant — the four hops stack */}
        <svg className="ezh-fig-narrow" viewBox="0 0 330 700" focusable="false">
          <text className="ezh-f-lbl" x="2" y="14">01 · Named sources</text>
          <rect className="ezh-f-paper" x="2" y="24" width="326" height="40" rx="3" />
          <text className="ezh-f-g is-confirmed" x="16" y="49">●</text>
          <text className="ezh-f-val" x="36" y="43">NPPES registry</text>
          <text className="ezh-f-mut" x="322" y="43" textAnchor="end">read live</text>
          <rect className="ezh-f-paper" x="2" y="72" width="326" height="40" rx="3" />
          <text className="ezh-f-g is-snapshot" x="16" y="97">◐</text>
          <text className="ezh-f-val" x="36" y="91">OIG exclusion file</text>
          <text className="ezh-f-mut" x="322" y="91" textAnchor="end">monthly snapshot</text>
          <rect className="ezh-f-paper" x="2" y="120" width="326" height="40" rx="3" />
          <text className="ezh-f-g is-access" x="16" y="145">⊘</text>
          <text className="ezh-f-val" x="36" y="139">State licensure</text>
          <text className="ezh-f-mut" x="322" y="139" textAnchor="end">not readable</text>
          <path className="ezh-f-gate" d="M148 168 H182" />
          <text className="ezh-f-lbl" x="192" y="173">only you can open it</text>
          <path className="ezh-f-link is-acc" d="M165 176 V196" />

          <text className="ezh-f-lbl" x="2" y="216">02 · Your record, for life</text>
          <rect className="ezh-f-paper" x="2" y="226" width="326" height="196" rx="3" />
          <text className="ezh-f-data" x="18" y="250">NPI ··· ··· ····</text>
          <path className="ezh-f-hair" d="M18 260 H312" />
          <g>
            <rect className="ezh-f-tile" x="18" y="270" width="294" height="34" rx="3" />
            <text className="ezh-f-g is-confirmed" x="30" y="292">●</text>
            <text className="ezh-f-val" x="48" y="292">Identity</text>
            <rect className="ezh-f-bar" x="200" y="284" width="96" height="7" rx="3.5" />
          </g>
          <g>
            <rect className="ezh-f-tile" x="18" y="312" width="294" height="34" rx="3" />
            <text className="ezh-f-g is-snapshot" x="30" y="334">◐</text>
            <text className="ezh-f-val" x="48" y="334">Exclusion screen</text>
            <rect className="ezh-f-bar" x="200" y="326" width="72" height="7" rx="3.5" />
          </g>
          <g>
            <rect className="ezh-f-tile is-open" x="18" y="354" width="294" height="34" rx="3" />
            <text className="ezh-f-g is-access" x="30" y="376">⊘</text>
            <text className="ezh-f-val" x="48" y="376">Licensure · access-gated</text>
          </g>
          <g>
            <rect className="ezh-f-tile is-open" x="18" y="396" width="294" height="18" rx="3" />
            <text className="ezh-f-mut" x="30" y="409">○ rows not yet checked stay open</text>
          </g>
          <path className="ezh-f-link is-acc" d="M165 428 V448" />

          <text className="ezh-f-lbl" x="2" y="468">03 · Consent</text>
          <path className="ezh-f-gate" d="M2 482 H140" />
          <path className="ezh-f-gate" d="M190 482 H328" />
          <rect
            className="ezh-f-pktdot"
            x="160"
            y="476"
            width="11"
            height="11"
            rx="2"
            style={{ ['--ezh-tx' as never]: '26px' }}
          />
          <text className="ezh-f-lbl" x="165" y="506" textAnchor="middle">one exact packet</text>
          <path className="ezh-f-link is-acc" d="M165 514 V532" />

          <text className="ezh-f-lbl" x="2" y="552">04 · Employer review</text>
          <rect className="ezh-f-paper" x="2" y="562" width="326" height="132" rx="3" />
          <text className="ezh-f-val" x="18" y="586">Exceptions queue · not a folder</text>
          <path className="ezh-f-hair" d="M18 596 H312" />
          <g>
            <rect className="ezh-f-tile" x="18" y="606" width="294" height="24" rx="3" />
            <text className="ezh-f-g is-attention" x="30" y="623">▲</text>
            <text className="ezh-f-val" x="48" y="623">One named item open · owner: you</text>
          </g>
          <g>
            <rect className="ezh-f-tile is-wash" x="18" y="638" width="294" height="24" rx="3" />
            <text className="ezh-f-val" x="30" y="655">Everything else, source-backed</text>
          </g>
          <text className="ezh-f-lbl" x="18" y="684">the decision stays with the employer</text>
        </svg>
      </div>
      <div className="ezh-fig-legend" aria-hidden="true">
        <span><i className="is-acc" /> a reading, released by you</span>
        <span><i /> a source we may not read</span>
        <span><i className="is-solid" /> consent gate · opened only by you</span>
      </div>
      <figcaption className="ezh-fig-cap">
        <span className="ezh-sr">{TRANSCRIPT} </span>
        Illustrative &mdash; no copies of documents move, only readings with a source and a
        cadence. Values are blank bars because the real ones are yours.
      </figcaption>
    </figure>
  );
}
