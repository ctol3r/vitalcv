import * as React from 'react';
import { cn } from '@/lib/utils';
import type { CrossCheckExample } from '@/lib/demo/demoFixtures';

/**
 * Renders the per-lane cross-check state in plain institutional
 * language. Maps:
 *   pending_review        -> "Pending review"
 *   in_review             -> "In review"
 *   institution_confirmed -> "Institution-confirmed"
 *   not_eligible          -> "Not eligible (institution-owned)"
 *
 * Affirmative confirmation is always operator-owned. The component
 * never marks a lane confirmed automatically.
 */
export interface CrossCheckNarrativeProps {
  lanes: readonly CrossCheckExample[];
  className?: string;
}

const ACTION_LABEL: Record<CrossCheckExample['institutionAction'], string> = {
  pending_review: 'Pending review',
  in_review: 'In review',
  institution_confirmed: 'Institution-confirmed',
  not_eligible: 'Not eligible (institution-owned)',
};

const REVIEW_LABEL: Record<CrossCheckExample['humanReviewState'], string> = {
  not_required: 'not required',
  pending: 'pending operator review',
  completed: 'completed',
};

export function CrossCheckNarrative({
  lanes,
  className,
}: CrossCheckNarrativeProps) {
  return (
    <section
      data-slot="cross-check-narrative"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Independent cross-check · institution-owned confirmation
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          The receiving institution confirms each lane on its own
          credential. VitalCV surfaces the affordance; it never marks a
          lane confirmed without operator action.
        </p>
      </header>
      <ul className="divide-y divide-slate-200">
        {lanes.map((lane) => (
          <li
            key={lane.laneId}
            data-slot="cross-check-row"
            data-lane-id={lane.laneId}
            data-action={lane.institutionAction}
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Lane
              </div>
              <div className="mt-1 font-mono text-xs text-slate-900">
                {lane.laneId}
              </div>
              <div className="mt-0.5 text-xs text-slate-600">{lane.source}</div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Institution action
              </div>
              <div className="mt-1 font-mono text-xs text-slate-900">
                {ACTION_LABEL[lane.institutionAction]}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Human review
              </div>
              <div className="mt-1 font-mono text-xs text-slate-900">
                {REVIEW_LABEL[lane.humanReviewState]}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Note
              </div>
              <div className="mt-1 text-xs text-slate-700">{lane.note}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
