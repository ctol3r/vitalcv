import * as React from 'react';
import { cn } from '@/lib/utils';
import type { CrossCheckLaneRow } from '@/lib/interoperability/demoExchanges';

/**
 * Independent Cross-Check lane.
 *
 * Demonstrates the "trust but verify" institutional workflow: the
 * receiving institution sees the originating institution's evidence
 * AND a per-lane affordance to confirm the lane on its own credential.
 *
 * This is rehearsal infrastructure. The panel does NOT initiate
 * cross-checks; it demonstrates the SHAPE of a cross-check workflow
 * that a receiving institution would run on its own systems. No
 * "instant verification" semantics, no automated trust-transfer
 * claims. Each lane carries an institution-owned status that the
 * receiving operator advances by hand.
 */

export interface IndependentCrossCheckPanelProps {
  lanes: readonly CrossCheckLaneRow[];
  className?: string;
}

const INSTITUTION_STATUS_LABEL: Record<
  CrossCheckLaneRow['institutionStatus'],
  string
> = {
  pending: 'Pending review',
  in_review: 'Institution review in progress',
  confirmed: 'Institution-confirmed',
  not_eligible: 'Not eligible for cross-check',
};

const CONTINUITY_LABEL: Record<CrossCheckLaneRow['continuityStatus'], string> = {
  fresh: 'fresh',
  degraded: 'degraded · stale-but-signed',
  interrupted: 'interrupted',
};

const HUMAN_REVIEW_LABEL: Record<CrossCheckLaneRow['humanReviewState'], string> = {
  not_required: 'not required',
  pending: 'pending operator review',
  completed: 'completed',
};

export function IndependentCrossCheckPanel({
  lanes,
  className,
}: IndependentCrossCheckPanelProps) {
  return (
    <section
      data-slot="independent-cross-check-panel"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Independent cross-check lane · institution-owned confirmation
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Receiving institution may confirm each lane on its own credential.
          No lane is marked confirmed automatically; affirmative confirmation
          is operator-owned.
        </p>
      </header>
      <div className="divide-y divide-slate-200">
        {lanes.map((lane) => (
          <article
            key={lane.laneId}
            data-slot="cross-check-lane"
            data-lane-id={lane.laneId}
            data-institution-status={lane.institutionStatus}
            data-continuity-status={lane.continuityStatus}
            className={cn(
              'grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-12',
              lane.continuityStatus === 'degraded' &&
                'border-l-4 border-l-amber-400',
              lane.continuityStatus === 'interrupted' &&
                'border-l-4 border-l-rose-500',
            )}
          >
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Lane
              </div>
              <div className="mt-0.5 font-mono text-sm text-slate-900">
                {lane.laneId}
              </div>
              <div className="mt-0.5 text-xs text-slate-600">{lane.source}</div>
              <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                {lane.sourceRef}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Replay ref
              </div>
              <div className="mt-0.5 font-mono text-xs text-slate-900 break-all">
                {lane.replayRef || '—'}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Continuity
              </div>
              <div className="mt-0.5 font-mono text-xs text-slate-900">
                {CONTINUITY_LABEL[lane.continuityStatus]}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Institution status
              </div>
              <div className="mt-0.5 font-mono text-xs text-slate-900">
                {INSTITUTION_STATUS_LABEL[lane.institutionStatus]}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Human review
              </div>
              <div className="mt-0.5 font-mono text-xs text-slate-900">
                {HUMAN_REVIEW_LABEL[lane.humanReviewState]}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Gap note
              </div>
              <div className="mt-0.5 text-xs text-slate-700">
                {lane.gapNote ?? 'No gap recorded.'}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
