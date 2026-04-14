'use client';

import { useEffect, useState, useTransition } from 'react';
import { trackPilotEvent } from '@/lib/pilot-ops/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { safeFetch, SafeFetchError } from '@/lib/safe-fetch';

export type NextBestActionKind =
  | 'PROCEED'
  | 'REVERIFY'
  | 'ESCALATE'
  | 'REVIEW_MANUALLY';

export interface NextBestActionPayload {
  action: NextBestActionKind;
  reason: string;
  confidence: number;
  evidenceCount: number;
}

interface ActionMeta {
  headline: string;
  cta: string;
  pending: string;
  done: string;
  tone: string;
  cardTone: string;
  // The backend action kind that NBA recommends (or null = informational only)
  backendAction: 'accept' | 'request_data' | 'flag' | null;
  successToast: string;
}

const META: Record<NextBestActionKind, ActionMeta> = {
  PROCEED: {
    headline: 'Ready to proceed',
    cta: 'Proceed',
    pending: 'Recording…',
    done: 'Saved',
    tone: 'border-green-600 bg-green-600 text-white hover:bg-green-700',
    cardTone: 'border-green-500/40 bg-green-500/10 text-green-800',
    backendAction: 'accept',
    successToast: 'Proceed action recorded',
  },
  REVERIFY: {
    headline: 'Refresh verification',
    cta: 'Request refresh',
    pending: 'Sending…',
    done: 'Request sent',
    tone: 'border-amber-600 bg-amber-600 text-white hover:bg-amber-700',
    cardTone: 'border-amber-500/40 bg-amber-500/10 text-amber-800',
    backendAction: 'request_data',
    successToast: 'Verification request sent',
  },
  ESCALATE: {
    headline: 'Escalate for review',
    cta: 'Escalate',
    pending: 'Escalating…',
    done: 'Escalated',
    tone: 'border-red-600 bg-red-600 text-white hover:bg-red-700',
    cardTone: 'border-red-500/40 bg-red-500/10 text-red-800',
    backendAction: 'flag',
    successToast: 'Issue escalated',
  },
  REVIEW_MANUALLY: {
    headline: 'Manual review needed',
    cta: 'Open review',
    pending: '…',
    done: '…',
    tone: 'border-foreground bg-foreground text-background hover:opacity-90',
    cardTone: 'border-slate-500/40 bg-slate-500/10 text-slate-800',
    backendAction: null,
    successToast: 'Recorded',
  },
};

export function NextBestActionCard({
  npi,
  nba,
}: {
  npi: string;
  nba: NextBestActionPayload;
}) {
  const meta = META[nba.action];
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, setState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  // Pilot tracking: NBA visibility on mount. Fire-and-forget.
  useEffect(() => {
    void trackPilotEvent({
      eventType: 'readiness_revealed',
      oncePerSession: false,
      details: {
        surface: 'public_review_next_best_action',
        npi,
        recommendedAction: nba.action,
        confidence: nba.confidence,
        evidenceCount: nba.evidenceCount,
      },
    });
    // Only fire on (npi, action) change — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npi, nba.action]);

  const handleClick = async () => {
    if (state === 'submitting' || state === 'done') return;

    void trackPilotEvent({
      eventType: 'employer_action_clicked',
      oncePerSession: false,
      details: {
        surface: 'public_review_next_best_action',
        npi,
        recommendedAction: nba.action,
        backendAction: meta.backendAction,
      },
    });

    if (!meta.backendAction) {
      // Informational only — no server action.
      toast.message('Open this clinician’s full review to take action.');
      return;
    }
    setState('submitting');
    try {
      await safeFetch('/api/employer-actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ npi, action: meta.backendAction }),
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      setState('done');
      void trackPilotEvent({
        eventType: 'employer_action_taken',
        oncePerSession: false,
        details: {
          surface: 'public_review_next_best_action',
          npi,
          recommendedAction: nba.action,
          backendAction: meta.backendAction,
        },
      });
      toast.success(meta.successToast);
      startTransition(() => router.refresh());
    } catch (err) {
      const layer = err instanceof SafeFetchError ? err.layer : 'unknown';
      const message = err instanceof Error ? err.message : String(err);
      console.error('[NextBestActionCard] Failed to record action', {
        npi,
        action: nba.action,
        backendAction: meta.backendAction,
        layer,
        error: message,
      });
      void trackPilotEvent({
        eventType: 'route_failure',
        oncePerSession: false,
        severity: 'high',
        message: 'Public review next best action failed to persist.',
        details: {
          surface: 'public_review_next_best_action',
          npi,
          recommendedAction: nba.action,
          backendAction: meta.backendAction,
          layer,
          error: message,
        },
        queueItem: {
          source: 'route_failure',
          title: 'Employer action failed to persist',
          message: 'The public review surface could not save the selected action.',
          severity: 'high',
          blocking: false,
        },
      });
      setState('error');
      toast.error(
        err instanceof Error ? `Couldn’t record action: ${err.message}` : 'Action failed',
      );
      setTimeout(() => setState('idle'), 1200);
    }
  };

  const confidencePct = Math.round(nba.confidence * 100);
  const isDoing = state === 'submitting';
  const isDone = state === 'done';

  return (
    <div className={`rounded-2xl border-2 ${meta.cardTone} p-6 sm:p-8`}>
      <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
        Recommended next step
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">
        {meta.headline}
      </h1>
      <p className="mt-3 break-words text-base font-medium opacity-90 md:text-lg">
        {nba.reason}
      </p>

      <p className="mt-4 text-sm font-semibold opacity-80">{confidencePct}% confidence</p>

      <button
        type="button"
        onClick={handleClick}
        disabled={isDoing || isDone}
        aria-busy={isDoing}
        className={`mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-xl border-2 px-6 py-3 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99] sm:w-auto ${meta.tone}`}
      >
        {isDoing ? meta.pending : isDone ? meta.done : meta.cta}
      </button>
    </div>
  );
}
