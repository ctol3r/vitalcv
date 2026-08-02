import { cn } from '@/lib/utils';

/**
 * ApplicationEvidenceTimeline — what happened to a clinician's evidence during
 * an application, in order, with who did it and when.
 *
 * **A sequence, not a graph.** `R1` in `scripts/check-design-lint.ts` is an
 * ERROR-mode rule banning graph vocabulary and node/edge drawing, and CD-13
 * retires node-link people diagrams. The reference harvest settled that this is
 * not a compromise: Dock Labs — the directive's named source for
 * "issuer/holder/verifier relationships" — never draws a node-link graph on any
 * of its five marketing pages. It uses a numbered sequence. The conflict was
 * with a description of Dock, not with Dock.
 *
 * HiringCafe (measured 2026-08-01) puts a relative age stamp on every result
 * row. That is exactly CD-2.2's required `age` component, and it is adopted here
 * per entry rather than once per page — a reader should never have to hunt for
 * how old a thing is.
 */
export interface EvidenceTimelineEntry {
  /** What happened. Prose → sans. */
  event: string;
  /** Who did it. Named party → mono (CD-8). */
  actor: string;
  /** When. Mono, tabular. */
  at: string;
  /** Optional: the source that backed this step. */
  source?: string;
}

export interface ApplicationEvidenceTimelineProps {
  entries: EvidenceTimelineEntry[];
  /** Accessible name — e.g. "Evidence history for application 4821". */
  label: string;
  className?: string;
}

export function ApplicationEvidenceTimeline({
  entries,
  label,
  className,
}: ApplicationEvidenceTimelineProps) {
  return (
    <section aria-label={label} className={cn('w-full', className)}>
      <ol className="m-0 list-none border-t border-[var(--vt-border)] p-0">
        {entries.map((entry) => (
          <li
            key={`${entry.at}-${entry.event}`}
            className={cn(
              'grid gap-x-[var(--vt-space-16)] gap-y-[var(--vt-space-4)] border-b border-[var(--vt-border)] py-[var(--vt-space-12)]',
              'sm:grid-cols-[minmax(0,16ch)_1fr]',
            )}
          >
            {/* Age first — CD-2.2 treats it as part of the assertion, not a
                footnote. Mono because it is a machine fact (CD-8). */}
            <span className="font-[var(--vt-font-mono,ui-monospace)] text-[0.75rem] leading-[1.5] tabular-nums text-[var(--vt-text-muted)]">
              {entry.at}
            </span>
            <span className="flex flex-col gap-[var(--vt-space-4)]">
              <span className="text-[0.875rem] leading-[1.5] text-[var(--vt-text-primary)]">
                {entry.event}
              </span>
              <span className="font-[var(--vt-font-mono,ui-monospace)] text-[0.6875rem] leading-[1.4] tracking-[0.04em] text-[var(--vt-text-muted)]">
                {entry.actor}
                {entry.source ? ` · ${entry.source}` : ''}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
