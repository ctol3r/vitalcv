'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Replaces static review buttons with a bounded acknowledgment
 * control. Three local-only states:
 *   - idle           (no acknowledgment yet)
 *   - acknowledged   (operator acknowledged a posture review)
 *   - withdrawn      (operator un-acknowledged)
 *
 * No backend write. No approval simulation. The component is
 * explicit about this: an acknowledged record is a local-only UI
 * note that the operator looked at the surface; it does not constitute
 * an institutional decision and does not move the application
 * forward in any backend system.
 */
export type ReviewPosture = 'accept_as_head_start' | 'request_more_info' | 'reject';

export interface ReviewAcknowledgementProps {
  applicationId: string;
  postures: readonly ReviewPosture[];
  className?: string;
  /** Optional callback invoked when an acknowledgment is recorded. */
  onAcknowledge?: (posture: ReviewPosture) => void;
}

const POSTURE_LABEL: Record<ReviewPosture, string> = {
  accept_as_head_start: 'Acknowledge as head-start',
  request_more_info: 'Acknowledge as request-more-info',
  reject: 'Acknowledge as not eligible (institution-owned)',
};

const POSTURE_DESCRIPTION: Record<ReviewPosture, string> = {
  accept_as_head_start:
    'The operator has reviewed the lane state and would treat this clinician as a head-start candidate for the institution\'s own credentialing cadence.',
  request_more_info:
    'The operator has reviewed the lane state and would request additional evidence before considering this clinician further.',
  reject:
    'The operator has reviewed the lane state and would not proceed. Final eligibility decisions remain institution-owned.',
};

type AcknowledgementState =
  | { phase: 'idle' }
  | { phase: 'acknowledged'; posture: ReviewPosture; at: string };

export function ReviewAcknowledgement({
  applicationId,
  postures,
  className,
  onAcknowledge,
}: ReviewAcknowledgementProps) {
  const [state, setState] = React.useState<AcknowledgementState>({ phase: 'idle' });

  const acknowledge = React.useCallback(
    (posture: ReviewPosture) => {
      const at = new Date().toISOString();
      setState({ phase: 'acknowledged', posture, at });
      onAcknowledge?.(posture);
    },
    [onAcknowledge],
  );

  const withdraw = React.useCallback(() => {
    setState({ phase: 'idle' });
  }, []);

  return (
    <section
      data-slot="review-acknowledgement"
      data-application-id={applicationId}
      data-phase={state.phase}
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-600">
          Review posture · operator acknowledgment only
        </div>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          Acknowledgments are local-only UI notes. They do not change
          the application state in any backend, do not constitute an
          institutional decision, and do not move the clinician
          forward. Final eligibility remains institution-owned.
        </p>
      </header>

      {state.phase === 'idle' ? (
        <div
          data-slot="review-acknowledgement-postures"
          className="flex flex-wrap gap-2 px-4 py-3"
        >
          {postures.map((posture) => (
            <button
              key={posture}
              type="button"
              data-slot="review-acknowledgement-posture-button"
              data-posture={posture}
              onClick={() => acknowledge(posture)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-900 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
            >
              {POSTURE_LABEL[posture]}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3 px-4 py-3">
          <div
            data-slot="review-acknowledgement-recorded"
            data-recorded-posture={state.posture}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Acknowledged
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {POSTURE_LABEL[state.posture]}
            </div>
            <p className="mt-1 text-xs text-slate-700">
              {POSTURE_DESCRIPTION[state.posture]}
            </p>
            <div className="mt-2 font-mono text-[10px] text-slate-500">
              Recorded locally at {state.at}
            </div>
          </div>
          <button
            type="button"
            data-slot="review-acknowledgement-withdraw"
            onClick={withdraw}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Withdraw acknowledgment
          </button>
        </div>
      )}
    </section>
  );
}
