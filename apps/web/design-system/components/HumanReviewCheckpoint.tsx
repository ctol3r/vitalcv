import { cn } from '@/lib/utils';

/**
 * HumanReviewCheckpoint — the point where a named human decides, stated openly.
 *
 * Reference: Medallion's homepage, measured 2026-08-01 — "Experts-in-the-loop",
 * "Checkpoint review", "Built-in compliant oversight". That is the closest
 * external analogue to this component, and it is evidence a buyer WANTS the
 * human gate named rather than hidden. The competitor names it; we can afford
 * to name it more precisely, because in our case it is the thing that keeps the
 * product honest rather than a feature bullet.
 *
 * This is the visual half of the invariant the issuer chain already enforces in
 * code: a `PSVReceiptCandidate` carries `decisionGrade: false` as a LITERAL
 * type, and only `accept_candidate` under `policyReview.ts` may produce one,
 * behind five ordered gates. The interface must never imply the machine
 * finished the job.
 *
 * Hence `awaitingWhom` is required and rendered. "Pending" alone is the failure
 * mode — it tells a clinician something is happening without saying who owes the
 * next move, which reads as system delay rather than as a human decision that
 * has not been made yet.
 */
export type CheckpointState = 'awaiting' | 'in-review' | 'returned' | 'decided';

const STATE_META: Record<CheckpointState, { word: string; glyph: string; hue: string }> = {
  // CD-5: the state WORD is always --vt-text-primary. The hue carries only the
  // glyph and the left rule, so contrast never depends on the state colour and
  // grayscale never costs legibility.
  awaiting: { word: 'Awaiting review', glyph: '○', hue: 'var(--vt-border)' },
  'in-review': { word: 'In review', glyph: '◐', hue: 'var(--vt-state-pending)' },
  returned: { word: 'Returned with questions', glyph: '▲', hue: 'var(--vt-state-pending)' },
  decided: { word: 'Decided', glyph: '●', hue: 'var(--vt-state-source-confirmed)' },
};

export interface HumanReviewCheckpointProps {
  state: CheckpointState;
  /** Who owes the next move. Required — "pending" without an owner is not honest. */
  awaitingWhom: string;
  /** What they are deciding. Prose. */
  decision: string;
  /** When the state last changed. Mono machine fact (CD-8). */
  asOf: string;
  className?: string;
}

export function HumanReviewCheckpoint({
  state,
  awaitingWhom,
  decision,
  asOf,
  className,
}: HumanReviewCheckpointProps) {
  const meta = STATE_META[state];

  return (
    <section
      className={cn(
        'rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-[var(--vt-space-16)]',
        // CD-5: a 2px left rule in the state hue. Colour is the modifier, never
        // the message.
        'border-l-2',
        className,
      )}
      style={{ borderLeftColor: meta.hue }}
    >
      <p className="m-0 flex items-center gap-[var(--vt-space-8)]">
        <span aria-hidden="true" style={{ color: meta.hue }} className="text-[0.75rem]">
          {meta.glyph}
        </span>
        {/* The word is ink, always (CD-5). */}
        <span className="font-[var(--vt-font-mono,ui-monospace)] text-[0.75rem] uppercase tracking-[0.06em] text-[var(--vt-text-primary)]">
          {meta.word}
        </span>
      </p>

      <p className="mt-[var(--vt-space-8)] mb-0 max-w-[62ch] text-[0.9375rem] leading-[1.55] text-[var(--vt-text-primary)]">
        {decision}
      </p>

      <p className="mt-[var(--vt-space-8)] mb-0 font-[var(--vt-font-mono,ui-monospace)] text-[0.6875rem] leading-[1.4] tracking-[0.04em] text-[var(--vt-text-muted)]">
        {awaitingWhom} · {asOf}
      </p>

      <p className="mt-[var(--vt-space-12)] mb-0 max-w-[62ch] text-[0.8125rem] leading-[1.5] text-[var(--vt-text-secondary)]">
        A person makes this decision. VitalCV prepares the evidence and does not
        make it.
      </p>
    </section>
  );
}
