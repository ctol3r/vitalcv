import ApprovalBoundaryFigure from '@/components/home/easy/figures/ApprovalBoundaryFigure';
import ReuseFigure from '@/components/home/easy/figures/ReuseFigure';

/**
 * The route's one dark band (amendment E, dark-band row). The seven steps and
 * both boundary sentences are the pinned approval story and are UNCHANGED;
 * the approval-boundary and reuse figures redraw the band's material, not its
 * story. The reuse figure renders as step 7's expansion, directly under the
 * track.
 */

const STEPS = [
  {
    id: 'record',
    label: 'Your record',
    detail: 'Source state and freshness stay attached.',
  },
  {
    id: 'opportunity',
    label: 'Opportunity',
    detail: 'The listing and its source stay visible.',
  },
  {
    id: 'choice',
    label: 'Your choice',
    detail: 'You select what the employer may review.',
  },
  {
    id: 'packet',
    label: 'Exact packet',
    detail: 'The submitted record is sealed as its own version.',
  },
  {
    id: 'review',
    label: 'Employer review',
    detail: 'The institution reviews that exact packet.',
  },
  {
    id: 'recognition',
    label: 'Accepted head start',
    detail: 'Only after the employer records that decision.',
  },
  {
    id: 'reuse',
    label: 'Reuse',
    detail: 'Fresh clinician consent is required next time.',
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
        <div className="ezh-mobility-lead">
          <div className="ezh-mobility-head">
            <span className="ezh-k">Sharing</span>
            <h2 id="ezh-mobility-heading">Only what you approved crosses over.</h2>
            <p>
              When you apply, a copy carrying just the rows you approved goes to the employer.
              The complete profile never leaves &mdash; it stays with you, ready for the next
              role.
            </p>
          </div>
          <ApprovalBoundaryFigure />
        </div>

        <ol className="ezh-mobility-track">
          {STEPS.map((step, index) => (
            <li key={step.id} data-mobility-step={step.id}>
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

        <div className="ezh-mobility-reuse" data-mobility-step-expansion="reuse">
          <ReuseFigure />
        </div>

        <p className="ezh-mobility-boundary">
          Illustrative process &mdash; not a current application, employer decision, accepted head
          start, or actual start. Institution review remains.
        </p>
      </div>
    </section>
  );
}
