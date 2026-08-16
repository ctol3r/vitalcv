import { FigureApproval, FigureReuse } from '@/components/home/easy/HomeFigures';

const STEPS = [
  {
    id: 'record',
    label: 'Your record',
    detail: 'Source state and freshness stay attached.',
    object: 'folio',
  },
  {
    id: 'opportunity',
    label: 'Opportunity',
    detail: 'The listing and its source stay visible.',
    object: 'window',
  },
  {
    id: 'choice',
    label: 'Your choice',
    detail: 'You select what the employer may review.',
    object: 'gate',
  },
  {
    id: 'packet',
    label: 'Exact packet',
    detail: 'The submitted record is sealed as its own version.',
    object: 'packet',
  },
  {
    id: 'review',
    label: 'Employer review',
    detail: 'The institution reviews that exact packet.',
    object: 'desk',
  },
  {
    id: 'recognition',
    label: 'Accepted head start',
    detail: 'Only after the employer records that decision.',
    object: 'seal',
  },
  {
    id: 'reuse',
    label: 'Reuse',
    detail: 'Fresh clinician consent is required next time.',
    object: 'return',
  },
] as const;

export default function CareerMobilitySequence() {
  return (
    <section
      className="ezh-mobility"
      data-home-mobility-sequence=""
      data-header-theme="dark"
      aria-labelledby="ezh-mobility-heading"
    >
      <div className="ezh-wrap">
        <div className="ezh-mobility-head">
          <span className="ezh-k">One record, carried forward</span>
          <h2 id="ezh-mobility-heading">The career move becomes one continuous object.</h2>
          <p>
            VitalCV keeps the source, your choice, the employer&rsquo;s decision, and the next
            use connected without pretending an institution&rsquo;s review has already happened.
          </p>
        </div>

        <ol className="ezh-mobility-track">
          {STEPS.map((step, index) => (
            <li key={step.id} data-mobility-step={step.id}>
              <div className={`ezh-tactile-object is-${step.object}`} aria-hidden="true">
                <span className="ezh-tactile-sheet sheet-back" />
                <span className="ezh-tactile-sheet sheet-front" />
                <span className="ezh-tactile-mark" />
              </div>
              <div className="ezh-mobility-copy">
                <span className="ezh-mobility-index">
                  {String(index + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
                </span>
                <h3>{step.label}</h3>
                <p>{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        {/*
          Amendment E: the route's one dark band gains the approval-boundary and
          reuse figures. They redraw the band's material, not its story — the
          seven steps above and the boundary sentence below are unchanged.

          Both figures stop where the product stops. The approval figure's
          employer side receives and never resolves; the reuse figure repeats
          "approved each time" on every branch, because reuse is not standing
          consent (EC-25 §5).
        */}
        <div className="ezh-mobility-figures">
          <div className="ezh-mobility-figure">
            <span className="ezh-k">Sharing</span>
            <h3>Only what you approved crosses over.</h3>
            <p className="ezh-sec-p">
              When you apply, a copy carrying just the rows you approved goes to the employer. Your
              employer receives the exact record you approve. The complete profile never leaves
              &mdash; it stays with you, ready for the next role.
            </p>
            <FigureApproval />
          </div>

          <div className="ezh-mobility-figure">
            <span className="ezh-k">Reuse</span>
            <h3>Build it once. Use it for the next role, and the one after that.</h3>
            <p className="ezh-sec-p">
              The profile is not rebuilt for each application &mdash; but it is approved for each
              one. Reuse is not standing consent.
            </p>
            <FigureReuse />
          </div>
        </div>

        <p className="ezh-mobility-boundary">
          Illustrative process — not a current application, employer decision, accepted head start,
          or actual start. Institution review remains.
        </p>
      </div>
    </section>
  );
}
