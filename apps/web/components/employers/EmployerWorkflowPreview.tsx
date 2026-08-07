import { EMPLOYER_STAGES } from './employerWorkflow';

/**
 * EmployerWorkflowPreview (EMP-6.1) — the honest employer job-to-start loop,
 * replacing the three generic value cards. It shows a recruiter the whole
 * workflow they are buying — claim → requirements → consented packet → review →
 * head-start acceptance → start-ready — with each stage's honesty boundary
 * stated inline, and no fabricated people, candidates, metrics, or outcomes.
 *
 * Density pass (founder lever, 2026-08-07): the six bordered cards became
 * borderless grid cells with one-sentence bodies and the boundary rails kept
 * verbatim — the same de-chroming the audience section got at REVISION 2.
 * The grid stays 3-across on desktop because that is where its vertical
 * efficiency lives; the Reveal wrapper went with the card chrome.
 *
 * Calm Wave, employer persona: paper/ink, editorial indigo accent, full
 * content renders without JS.
 */
export function EmployerWorkflowPreview() {
  return (
    <section aria-label="How the employer workflow works" data-employer-workflow="" className="mt-10">
      <p className="mz-eyebrow">The workflow</p>
      <h2 className="mz-h2" style={{ marginTop: 8, maxWidth: 620 }}>
        From requesting access to a clinician&rsquo;s <span className="mz-accent">first day</span>.
      </h2>
      <p className="mz-small" style={{ marginTop: 8, marginBottom: 14, maxWidth: 620 }}>
        The same source-backed record a clinician carries becomes your review, your decision, and an
        auditable path to start — not another document chase.
      </p>

      {/* Ordinality is carried by the <ol> semantics and DOM order (the
          01–06 numbering was retired by CD-13); a hairline top rule stands in
          for the retired card borders so the group still reads as one set. */}
      <ol className="grid list-none grid-cols-1 gap-x-6 gap-y-3 border-t border-[var(--vt-border)] pt-3 sm:grid-cols-2 lg:grid-cols-3">
        {EMPLOYER_STAGES.map((stage) => (
          <li key={stage.id} className="flex flex-col">
            <h3 className="text-sm font-semibold leading-snug text-[var(--vt-text-primary)]">
              {stage.title}
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
              {stage.body}
            </p>
            {stage.boundary ? (
              <p
                data-stage-boundary=""
                className="mz-mono mt-1.5 border-l-2 border-[var(--vt-accent-editorial)] pl-2.5 text-[11px] leading-relaxed text-[var(--vt-text-muted)]"
              >
                {stage.boundary}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default EmployerWorkflowPreview;
