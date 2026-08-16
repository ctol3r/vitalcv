/**
 * Questions — the homepage FAQ.
 *
 * Ported from the Claude Design file `VitalCV Homepage v2.html` (section 06)
 * and re-cut into the `ezh-` register.
 *
 * WHY THIS SECTION EXISTS. "Is this credentialing?" is the single most
 * load-bearing boundary statement VitalCV has, and `/` did not answer it
 * anywhere. Leaving the most consequential objection to be inferred from a
 * footer line is how a reader arrives at the wrong model of the product and
 * only discovers it later.
 *
 * Answers are written to what the product does TODAY. Where the honest answer
 * is a limit, the limit is the answer — v2's version promised primary-source
 * verification, sub-60-second revocation propagation and free-forever pricing,
 * none of which is ours to promise.
 *
 * Native `<details>`: open/close survives no-JS and reduced-motion with no
 * work, and the summary is a real button to assistive tech. No keyframes, in
 * keeping with the island (see the header of `styles/easy-home.css`).
 *
 * Design Handoff References — EC-3, EC-4, EC-5 (44px summary target), EC-9.
 */

const QUESTIONS: { q: string; a: string }[] = [
  {
    q: 'Is this credentialing?',
    a: 'No. Credentialing is a decision an institution makes under its own policy, and VitalCV never makes it. What VitalCV does is get the evidence together first — what public federal sources already establish, what is still open, and where each line came from — so the review starts from something rather than from an empty file.',
  },
  {
    q: 'Which sources do you actually read?',
    a: 'The federal provider registry for identity and specialty, the federal exclusion list, and Medicare enrollment. State licence numbers are shown as you report them: we display the number, not a live status, because we cannot read board status in every state. Board certification is not checked at all. The footer states how fresh each source is, derived from the same registry the status page reads.',
  },
  {
    q: 'What happens to something I have already shared?',
    a: 'A submitted application stays as the exact historical record you approved. Your profile may change later, but the product shows current evidence separately instead of silently replacing what an employer received.',
  },
  {
    q: 'What does it cost to start?',
    a: 'Nothing to enter your NPI and see what comes back; no account is needed for that. Pricing beyond that point is on the pricing page rather than implied here.',
  },
];

export default function Questions() {
  return (
    <section className="ezh-faq" data-header-theme="light" aria-labelledby="ezh-faq-h">
      <div className="ezh-wrap">
        <div className="ezh-sec-head">
          <span className="ezh-k">Questions</span>
          <h2 id="ezh-faq-h">Asked before anyone signs up</h2>
        </div>

        <div className="ezh-faq-list">
          {QUESTIONS.map((item, i) => (
            <details key={item.q} className="ezh-faq-item" open={i === 0}>
              <summary className="ezh-faq-q">
                <span>{item.q}</span>
                <span className="ezh-faq-mark" aria-hidden="true" />
              </summary>
              <p className="ezh-faq-a">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
