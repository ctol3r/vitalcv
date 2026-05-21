import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  NEXT_STEP_OWNER_LABEL,
  OPERATOR_VISIBLE_STATE_LABEL,
  type OperatorReviewItem,
} from '@/lib/operator/operatorFixtures';

/**
 * Per-clinician review row showing where each pilot candidate is in
 * the receiving-institution review. Uses the four review stages
 * (queued / in_review / returned_to_operator / institution_owned)
 * mapped to the normalized visible states so the operator sees the
 * same vocabulary used everywhere else.
 */
export interface ReviewProgressPanelProps {
  reviews: readonly OperatorReviewItem[];
  className?: string;
}

export function ReviewProgressPanel({
  reviews,
  className,
}: ReviewProgressPanelProps) {
  return (
    <section
      data-slot="review-progress-panel"
      data-review-count={reviews.length}
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-600">
          Review progress · receiving-institution-owned
        </div>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-700">
          Per-clinician progress in the receiving institution's
          review. The receiving institution dispositions on its own
          cadence; this panel surfaces visibility, not control.
        </p>
      </header>
      <ul className="divide-y divide-slate-200">
        {reviews.map((review) => (
          <li
            key={review.id}
            data-slot="review-progress-row"
            data-review-id={review.id}
            data-stage={review.reviewStage}
            data-state={review.visibleState}
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Clinician
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {review.clinicianDisplayName}
              </div>
            </div>
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Stage
              </div>
              <div className="mt-1 text-sm text-slate-900">{review.reviewStageLabel}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                State
              </div>
              <div className="mt-1 text-sm text-slate-900">
                {OPERATOR_VISIBLE_STATE_LABEL[review.visibleState]}
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Owner
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {NEXT_STEP_OWNER_LABEL[review.reviewOwner]}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
