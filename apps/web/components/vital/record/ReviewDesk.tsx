import * as React from 'react';

import { RECORD_EDGE, RECORD_RADIUS } from './anatomy';

/**
 * ReviewDesk — the verifier, and the place this whole kit is most able to lie
 * (ILL-03).
 *
 * Z0 face 10: "Review checkpoint attaches to the recipient frame; the decision
 * owner is named." EC-25.5 is the hard line — "Employer scenes stop at review —
 * the review desk receives, it never resolves green."
 *
 * That rule is enforced structurally here, not left to the caller's judgement:
 * the component renders exactly one terminal state, `receiving`, and there is
 * no prop that produces an outcome. A future wave that wants an accepted or
 * declined desk has to add the state deliberately and answer EC-25.5 while
 * doing it — it cannot arrive by passing a different string.
 *
 * What the desk does show is the shape of a real review: something arrived,
 * something is still open, and a named actor — not VitalCV — decides. "The
 * employer decides" is used here because the employer genuinely decides this
 * matter, which is the condition EC-7 attaches to that exact phrase.
 */

export interface ReviewDeskProps {
  /** Rendered beside the desk; the composition supplies the surrounding prose. */
  openQuestion?: string;
  className?: string;
}

export function ReviewDesk({
  openQuestion = 'Can you confirm the dates on one of these?',
  className,
}: ReviewDeskProps) {
  return (
    <div
      data-review-desk=""
      data-desk-state="receiving"
      className={`flex flex-col gap-2.5 px-3 py-3 ${className ?? ''}`}
      style={{
        background: 'var(--vt-scene-panel)',
        border: `${RECORD_EDGE.hairlinePx}px solid var(--vt-scene-line)`,
        borderRadius: `${RECORD_RADIUS.evidencePx}px`,
        boxShadow: 'none',
      }}
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--vt-scene-text-secondary)]">
        Employer review
      </p>

      {/* The open question — a review that can ask is a review still in progress. */}
      <div
        className="px-2.5 py-2"
        style={{
          border: `${RECORD_EDGE.hairlinePx}px dashed var(--vt-scene-line-strong)`,
          borderRadius: `${RECORD_RADIUS.evidencePx}px`,
        }}
      >
        <p className="text-[11px] leading-snug text-[var(--vt-scene-text)]">{openQuestion}</p>
      </div>

      {/* The named decision owner. No mark, no colour, no outcome. */}
      <p className="text-[11px] leading-snug text-[var(--vt-scene-text-secondary)]">
        The employer decides. VitalCV does not, and nothing here has been decided yet.
      </p>
    </div>
  );
}
