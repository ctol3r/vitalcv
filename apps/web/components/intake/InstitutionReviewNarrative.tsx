import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Names the four institutional review surfaces explicitly. Each row
 * makes clear that VitalCV does NOT perform the review; it surfaces
 * the data the reviewer consults.
 */
export interface InstitutionReviewNarrativeProps {
  className?: string;
}

interface ReviewLane {
  surface: string;
  whoReviews: string;
  whatVitalcvSurfaces: string;
  whatVitalcvDoesNotDo: string;
}

const REVIEW_LANES: readonly ReviewLane[] = [
  {
    surface: 'State medical board verification',
    whoReviews: 'Your CVO channel · institution-owned PSV',
    whatVitalcvSurfaces:
      'NPPES identity and active practice state for the clinician.',
    whatVitalcvDoesNotDo:
      'VitalCV does not query state medical boards or assert license validity.',
  },
  {
    surface: 'Credentialing committee review',
    whoReviews: 'Your committee · institution-owned',
    whatVitalcvSurfaces:
      'A `committee_review_pending` event on the timeline so reviewers see the lane is open.',
    whatVitalcvDoesNotDo:
      'VitalCV does not record a committee decision.',
  },
  {
    surface: 'Privileging decisions',
    whoReviews: 'Your facility credentialing team · institution-owned',
    whatVitalcvSurfaces:
      'Nothing privileging-specific. Privileging is out of scope for the pilot.',
    whatVitalcvDoesNotDo:
      'VitalCV does not make any privileging assertion.',
  },
  {
    surface: 'Stale-but-signed lane disposition',
    whoReviews: 'Your operator · institution-owned',
    whatVitalcvSurfaces:
      'The lane carries a stale-flag plus the operator note explaining the upstream freshness boundary.',
    whatVitalcvDoesNotDo:
      'VitalCV does not auto-mark a stale lane as confirmed.',
  },
];

export function InstitutionReviewNarrative({
  className,
}: InstitutionReviewNarrativeProps) {
  return (
    <section
      data-slot="institution-review-narrative"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          What your institution still owns
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          Four review surfaces remain on your existing cadence. The
          pilot surfaces the data your reviewers consult; it never
          performs the review.
        </p>
      </header>
      <ul className="divide-y divide-slate-200">
        {REVIEW_LANES.map((row) => (
          <li
            key={row.surface}
            data-slot="institution-review-row"
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Surface
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {row.surface}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Who reviews
              </div>
              <div className="mt-1 text-xs text-slate-700">
                {row.whoReviews}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                What VitalCV surfaces
              </div>
              <p className="mt-1 text-xs text-slate-700">
                {row.whatVitalcvSurfaces}
              </p>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                What VitalCV does NOT do
              </div>
              <p className="mt-1 text-xs text-slate-700">
                {row.whatVitalcvDoesNotDo}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
