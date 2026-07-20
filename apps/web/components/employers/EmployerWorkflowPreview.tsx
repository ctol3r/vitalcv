import { Reveal } from '@/components/motion/Reveal';
import { EMPLOYER_STAGES } from './employerWorkflow';

/**
 * EmployerWorkflowPreview (EMP-6.1) — the honest employer job-to-start loop,
 * replacing the three generic value cards. It shows a recruiter the whole
 * workflow they are buying — claim → requirements → consented packet → review →
 * head-start acceptance → start-ready — with each stage's honesty boundary
 * stated inline, and no fabricated people, candidates, metrics, or outcomes.
 *
 * Calm Wave, employer persona: paper/ink, source-green accent, single-shot
 * Reveal entrance (reduced-motion-safe; full content renders without JS).
 */
export function EmployerWorkflowPreview() {
  return (
    <section aria-label="How the employer workflow works" data-employer-workflow="" className="mt-10">
      <p className="mz-eyebrow">The workflow</p>
      <h2 className="mz-h2" style={{ marginTop: 8, maxWidth: 620 }}>
        From claiming your organization to a clinician&rsquo;s <span className="mz-accent">first day</span>.
      </h2>
      <p className="mz-small" style={{ marginTop: 8, marginBottom: 20, maxWidth: 620 }}>
        The same source-backed record a clinician carries becomes your review, your decision, and an
        auditable path to start — not another document chase.
      </p>

      <ol className="grid list-none grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EMPLOYER_STAGES.map((stage, i) => (
          <Reveal
            key={stage.ordinal}
            as="li"
            delay={i * 70}
            className="flex flex-col rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4"
          >
            <span
              aria-hidden="true"
              className="mz-mono text-[11px] font-semibold tracking-[0.14em] text-[var(--vt-accent-emerald)]"
            >
              {stage.ordinal}
            </span>
            <h3 className="mt-1.5 text-sm font-semibold leading-snug text-[var(--vt-text-primary)]">
              {stage.title}
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
              {stage.body}
            </p>
            {stage.boundary ? (
              <p
                data-stage-boundary=""
                className="mz-mono mt-3 border-l-2 border-[var(--vt-accent-emerald)] pl-2.5 text-[11px] leading-relaxed text-[var(--vt-text-muted)]"
              >
                {stage.boundary}
              </p>
            ) : null}
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

export default EmployerWorkflowPreview;
