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
    <section aria-label="How the employer workflow works" data-employer-workflow="" className="mt-14">
      <p className="mz-eyebrow">The workflow</p>
      <h2 className="mz-h2" style={{ marginTop: 8, maxWidth: 620 }}>
        From a shared packet to a clinician&rsquo;s <span className="mz-accent">first day</span>.
      </h2>
      <p className="mz-small" style={{ marginTop: 8, marginBottom: 24, maxWidth: 620 }}>
        The same source-backed record a clinician carries becomes your review, your decision, and an
        auditable path to start — not another document chase.
      </p>

      {/* A ruled queue, not a grid of numbered cards. The `01 · 02 · 03`
          grammar is retired mechanism (competitive mandate: no step counters),
          and a card grid reads as a feature list — six things you get — when
          the point is that this is one sequence of work with a boundary at
          three of its steps. The ordinal stays in the DATA as a stable key and
          for ordering; it is simply no longer the loudest thing on screen. */}
      <ol className="list-none border-t border-[var(--vt-border)]">
        {EMPLOYER_STAGES.map((stage, i) => (
          <Reveal
            key={stage.ordinal}
            as="li"
            delay={i * 60}
            className="grid grid-cols-1 gap-x-8 gap-y-1.5 border-b border-[var(--vt-border)] py-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
          >
            <h3 className="text-sm font-semibold leading-snug text-[var(--vt-text-primary)]">
              {stage.title}
            </h3>
            <div>
              <p className="text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
                {stage.body}
              </p>
              {stage.boundary ? (
                <p
                  data-stage-boundary=""
                  className="mz-mono mt-2.5 border-l-2 border-[var(--vt-accent-emerald)] pl-2.5 text-[11px] leading-relaxed text-[var(--vt-text-muted)]"
                >
                  {stage.boundary}
                </p>
              ) : null}
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

export default EmployerWorkflowPreview;
