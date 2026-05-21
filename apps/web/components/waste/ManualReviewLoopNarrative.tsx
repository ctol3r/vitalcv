import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Narrative 5 · Manual review loops as waste.
 *
 * The receiving operator opens a packet, scans it, makes a note,
 * closes it, then comes back the next day and reads the same packet
 * again because nothing carried forward. The narrative names these
 * loops and names what the institution keeps doing (real review,
 * deliberate decisions). It does NOT claim to remove review; it
 * names the parts that are redundant scanning vs. the parts that
 * are deliberate judgement.
 */
export interface ManualReviewLoopNarrativeProps {
  className?: string;
}

interface ReviewLoopRow {
  loopName: string;
  whatRepeats: string;
  whatVitalCvCarries: string;
  whatStays: string;
}

const REVIEW_LOOP_ROWS: readonly ReviewLoopRow[] = [
  {
    loopName: 'Re-reading the same NPPES record',
    whatRepeats:
      'Sending operator reads NPPES. Receiving CVO reads NPPES the next day. Committee reviewer reads NPPES the week after.',
    whatVitalCvCarries:
      'The NPPES lane state, source reference, and observed-at timestamp travel with the replay envelope.',
    whatStays:
      'Each institution still reviews the lane on its own credential and dispositions on its own cadence.',
  },
  {
    loopName: 'Re-summarising the same operator note',
    whatRepeats:
      'Sending operator wrote a note about the PECOS stale-flag. Receiving operator re-summarises it for the committee. Committee re-summarises it for the chief of staff.',
    whatVitalCvCarries:
      'The operator note remains attached to the lane; subsequent reviewers read the note in place.',
    whatStays:
      'Each reviewer still decides whether the note is sufficient on their own credential.',
  },
  {
    loopName: 'Re-checking exclusion-list status',
    whatRepeats:
      'OIG/LEIE was checked at intake. Then checked again before deployment. Then sometimes a third time for the privileging packet.',
    whatVitalCvCarries:
      'The most recent exclusion-list check is in the lane with an explicit observed-at timestamp.',
    whatStays:
      'Each institution\'s freshness policy still determines whether to re-fetch on their own credential.',
  },
  {
    loopName: 'Reconciling source timestamps by hand',
    whatRepeats:
      'Operator opens three printouts and writes down the timestamps to compare them.',
    whatVitalCvCarries:
      'Timestamps and source references are rendered uniformly on the lane.',
    whatStays:
      'Reviewer still decides whether the timestamps satisfy the institution\'s freshness budget.',
  },
  {
    loopName: 'Tracking down the original requester',
    whatRepeats:
      'Receiving CVO sometimes has to phone the sending operator to ask "who actually ran this query?"',
    whatVitalCvCarries:
      'The operator identifier is recorded on the lane along with the run context.',
    whatStays:
      'Receiving CVO still owns the decision of whether to trust the upstream operator\'s read.',
  },
];

export function ManualReviewLoopNarrative({
  className,
}: ManualReviewLoopNarrativeProps) {
  return (
    <section
      data-slot="manual-review-loop-narrative"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Narrative 05 · manual review loops
        </div>
        <h3 className="mt-1 text-sm font-semibold text-slate-900">
          Some review is judgement. Some review is re-reading the packet.
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          The page does not propose removing review. It separates the
          parts that are redundant scanning (the same NPPES record read
          three times) from the parts that are deliberate institutional
          judgement (committee disposition, privileging). VitalCV carries
          the lane forward; the institution keeps the judgement.
        </p>
      </header>
      <ul className="divide-y divide-slate-200">
        {REVIEW_LOOP_ROWS.map((row) => (
          <li
            key={row.loopName}
            data-slot="manual-review-loop-row"
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Loop
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-900">
                {row.loopName}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                What repeats today
              </div>
              <div className="mt-1 text-xs text-slate-700">{row.whatRepeats}</div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                What the envelope carries
              </div>
              <div className="mt-1 text-xs text-slate-700">
                {row.whatVitalCvCarries}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                What stays with the institution
              </div>
              <div className="mt-1 text-xs text-slate-700">{row.whatStays}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
