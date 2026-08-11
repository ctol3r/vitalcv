/**
 * Attribution — "how VitalCV knows what it knows".
 *
 * Ported from the Claude Design file `VitalCV Homepage v2.html` (section 04,
 * the dark band + receipt ledger) and re-cut into the `ezh-` register.
 *
 * WHY THIS SECTION EXISTS. EasyHome already answers *whose move is it*
 * (`.ezh-own`, the four ownership cells). It never answered *how was this
 * established* — the homepage carried no credential-state vocabulary at all.
 * Those are two different axes and EC-3/EC-4 turn on the second one: four
 * distinct things must read as four distinct words, never flattened into one
 * green tick.
 *
 * WHAT DID NOT COME ACROSS FROM v2. Its ledger listed cryptographic receipts
 * (`Receipt 0x8f2a…c41d`) chipped `Verified` / `Pending` / `Revoked`. Issuer
 * receipts ship dark and carry `decisionGrade: false`, so a homepage ledger of
 * live receipt hashes would be fiction; and a bare past-participle status word
 * is banned outright (CLAUDE.md, `scripts/check-public-claims.ts`). The rows
 * below are the real source lanes and the chips are full state phrases.
 *
 * v2's trust-flow diagram is deliberately NOT ported: it restates ProcessStory
 * chapters 1–2, and a second systemic picture on the same page is duplication,
 * not clarity.
 *
 * Design Handoff References — EC-3 (truth invariants), EC-4 (meaning is never
 * carried by colour alone; remove every colour and this section still reads),
 * EC-9 (customer-facing language), EC-20 A-2 (a pill is never a state marker —
 * these chips take radius 0, matching `.ezh-st`).
 */

/**
 * The four states are drawn from the product's real lane vocabulary — Checked,
 * Pending, Access required, Blocked, Contradicted, Not checked (see
 * `--vt-state-*` in `styles/themes/index.css`). v2's fourth chip was `Revoked`,
 * which is NOT a state this system produces; teaching a customer a word the
 * product cannot show them is its own kind of over-claim, so it was replaced
 * with `Access required` — real, and the reason a licence shows a number but
 * no status.
 */
interface AttrState {
  /** The state word a clinician actually reads. */
  chip: string;
  /**
   * Which `--ezh-*` family paints it. Always redundant with the word, never
   * instead of it (EC-4).
   *
   * The scene register carries exactly three state hues — source-confirmed,
   * needs-person, waiting. There is deliberately no fourth: EC-20's full
   * state-hue family is a DEFERRED row owned by UX-02, and EC-22 forbids
   * resolving a deferred row by inventing a value. So a state without an
   * assigned hue renders in ink rather than borrowing a neighbour's colour,
   * which is also what EC-20 means by "state words always in ink".
   */
  tone: 'work' | 'hold' | 'wait' | 'ink';
  title: string;
  body: string;
}

const STATES: AttrState[] = [
  {
    chip: 'Source-confirmed',
    tone: 'work',
    title: 'A named source answered',
    body: 'We name which source and when it answered. If you want to check it yourself, you have everything you need to.',
  },
  {
    chip: 'You reported it',
    // Ink, not a hue: the three scene hues describe what a SOURCE said, and
    // this line describes who authored it. Different axis, so no state colour.
    tone: 'ink',
    title: 'It came from you',
    body: 'Yours to state, and labelled as yours. It is never quietly promoted to something a source confirmed.',
  },
  {
    chip: 'Access required',
    tone: 'wait',
    title: 'The source will not answer us',
    body: 'Some registries only answer an institution, not a person. Where that is true we say so, rather than showing a blank and letting it read as nothing to report.',
  },
  {
    chip: 'Not checked',
    tone: 'hold',
    title: 'We did not look',
    body: 'Some things we do not read at all. That is shown as a gap, because a gap you can see is worth more than one you find out about later.',
  },
];

/**
 * The ledger. These are the lanes the product actually reads today — not an
 * aspirational set. `Board certification` is on the list precisely BECAUSE it
 * is unchecked: a ledger that showed only the confirmed rows would be the
 * dishonest version of this component.
 */
const ROWS: { label: string; chip: string; tone: AttrState['tone'] }[] = [
  { label: 'Identity', chip: 'Source-confirmed', tone: 'work' },
  { label: 'Federal exclusion list', chip: 'Source-confirmed', tone: 'work' },
  { label: 'Medicare enrollment', chip: 'Source-confirmed', tone: 'work' },
  { label: 'State licence number', chip: 'You reported it', tone: 'ink' },
  { label: 'State board status', chip: 'Access required', tone: 'wait' },
  { label: 'Board certification', chip: 'Not checked', tone: 'hold' },
];

export default function Attribution() {
  return (
    <section className="ezh-attr" data-header-theme="dark" aria-labelledby="ezh-attr-h">
      <div className="ezh-wrap">
        <div className="ezh-sec-head">
          <span className="ezh-k">Attribution</span>
          <h2 id="ezh-attr-h">Every line says how it got there</h2>
        </div>
        <p className="ezh-sec-sub">
          Confirmed by a source, reported by you, not checked, withdrawn. Four different things, so
          four different words &mdash; never flattened into one green tick.
        </p>

        <div className="ezh-attr-grid">
          <ul className="ezh-attr-points">
            {STATES.map((s) => (
              <li key={s.chip}>
                <span className="ezh-attr-chip" data-tone={s.tone}>
                  {s.chip}
                </span>
                <span className="ezh-tt">{s.title}</span>
                <p>{s.body}</p>
              </li>
            ))}
          </ul>

          <div className="ezh-attr-panel">
            <span className="ezh-k">How a record reads</span>
            <ul className="ezh-attr-rows">
              {ROWS.map((r) => (
                <li key={r.label} className="ezh-attr-row">
                  <span className="ezh-attr-row-label">{r.label}</span>
                  <span className="ezh-attr-chip" data-tone={r.tone}>
                    {r.chip}
                  </span>
                </li>
              ))}
            </ul>
            <p className="ezh-attr-cap">
              Illustrative &mdash; the shape of a record, not a real person&rsquo;s.
            </p>
          </div>
        </div>

        <p className="ezh-attr-scope">
          None of this is a credentialing decision. It is the evidence an institution&rsquo;s review
          starts from, with the gaps named instead of buried.
        </p>
      </div>
    </section>
  );
}
