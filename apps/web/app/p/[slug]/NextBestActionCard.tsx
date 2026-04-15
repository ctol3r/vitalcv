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
    headline: 'Approve this candidate',
    cta: 'Approve Candidate',
    pending: 'Approving…',
    done: 'Approved',
    tone: 'border-green-600 bg-green-600 text-white hover:bg-green-700',
    cardTone: 'border-green-500/40 bg-green-500/10 text-green-800',
    backendAction: 'accept',
    successToast: 'You have approved this candidate',
  },
  REVERIFY: {
    headline: 'Run fresh verification',
    cta: 'Run Fresh Verification',
    pending: 'Sending request…',
    done: 'Request sent',
    tone: 'border-amber-600 bg-amber-600 text-white hover:bg-amber-700',
    cardTone: 'border-amber-500/40 bg-amber-500/10 text-amber-800',
    backendAction: 'request_data',
    successToast: 'You have requested fresh verification',
  },
  ESCALATE: {
    headline: 'Reject this candidate',
    cta: 'Reject Candidate',
    pending: 'Rejecting…',
    done: 'Rejected',
    tone: 'border-red-600 bg-red-600 text-white hover:bg-red-700',
    cardTone: 'border-red-500/40 bg-red-500/10 text-red-800',
    backendAction: 'flag',
    successToast: 'You have rejected this candidate',
  },
  REVIEW_MANUALLY: {
    headline: 'Processing — no action available yet',
    cta: 'Processing (No Action Available)',
    pending: '…',
    done: '…',
    tone: 'border-slate-400 bg-slate-100 text-slate-600 cursor-not-allowed',
    cardTone: 'border-slate-500/40 bg-slate-500/10 text-slate-800',
    backendAction: null,
    successToast: 'Recorded',
  },
};

interface CoverageInput {
  checks?: Array<{ sourceId: string; state?: string }>;
}

const SOURCE_LABELS: Record<string, string> = {
  NPPES_API: 'NPPES',
  NPPES: 'NPPES',
  OIG_LEIE: 'OIG',
  OIG: 'OIG',
  STATE_BOARD: 'State medical board',
  PECOS_PUBLIC: 'PECOS',
  PECOS: 'PECOS',
};

function deriveEvidenceSummary(coverage?: CoverageInput | null): {
  reason: string;
  sources: string[];
} {
  const checks = coverage?.checks ?? [];
  const verified = checks.filter((c) => c.state?.toLowerCase() === 'checked');
  if (verified.length === 0) {
    return { reason: '', sources: [] };
  }
  const fragments: string[] = [];
  const sources: string[] = [];
  for (const c of verified) {
    const label = SOURCE_LABELS[c.sourceId];
    if (!label || sources.includes(label)) continue;
    sources.push(label);
    if (c.sourceId === 'OIG_LEIE' || c.sourceId === 'OIG') fragments.push('OIG clear');
    else if (c.sourceId === 'STATE_BOARD') fragments.push('license active');
    else if (c.sourceId === 'NPPES_API' || c.sourceId === 'NPPES') fragments.push('identity verified');
    else if (c.sourceId === 'PECOS_PUBLIC' || c.sourceId === 'PECOS') fragments.push('PECOS enrolled');
  }
  return { reason: fragments.join(', '), sources };
}

const CONSEQUENCE_COPY: Record<NextBestActionKind, string | null> = {
  PROCEED: 'Approving will mark this candidate as ready for hiring within your system.',
  REVERIFY: 'A fresh verification request will be queued against the source authority.',
  ESCALATE: 'Rejecting will mark this candidate as high risk and notify your reviewers.',
  REVIEW_MANUALLY: null,
};

export function NextBestActionCard({
  npi,
  nba,
  coverage,
}: {
  npi: string;
  nba: NextBestActionPayload;
  coverage?: CoverageInput | null;
}) {
  const meta = META[nba.action];
  const evidence = deriveEvidenceSummary(coverage);
  const consequence = CONSEQUENCE_COPY[nba.action];
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

    // Low-confidence guard: if the signal is limited AND the action is a
    // non-review mutation (Approve / Reject), require explicit
    // confirmation before posting. Strong signal or REVIEW-only paths
    // skip the prompt entirely. Uses the platform confirm() so the
    // behavior is accessible and doesn't require a custom modal.
    if (
      confidenceTier === 'limited'
      && (nba.action === 'PROCEED' || nba.action === 'ESCALATE')
      && typeof window !== 'undefined'
    ) {
      const ok = window.confirm(
        `Signal is limited. ${meta.headline} anyway?`,
      );
      if (!ok) return;
    }

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

  const isDoing = state === 'submitting';
  const isDone = state === 'done';
  // Prefer evidence-derived reason over backend-supplied reason when we
  // have any verified sources to point to. Falls back to nba.reason
  // (and finally to a safe default) so the surface is never blank.
  const displayReason =
    evidence.reason || nba.reason || 'the verified information currently attached to this profile';

  // Plain-language confidence tier. NEVER a percentage — the three
  // tiers map to concrete signal states the user can reason about.
  // Derivation combines evidence (sources) + prior outcomes
  // (evidenceCount) + backend confidence float:
  //   Strong  — multiple verified sources AND meaningful history
  //   Limited — some evidence OR history, but not both at strength
  //   Needs review — no evidence, no history, or REVIEW_MANUALLY
  const confidenceTier: 'strong' | 'limited' | 'needs_review' =
    nba.action === 'REVIEW_MANUALLY' || (evidence.sources.length === 0 && nba.evidenceCount === 0)
      ? 'needs_review'
      : evidence.sources.length >= 2 && nba.evidenceCount >= 3 && nba.confidence >= 0.7
        ? 'strong'
        : 'limited';

  const confidenceLabel: Record<typeof confidenceTier, string> = {
    strong: 'Strong signal',
    limited: 'Limited signal',
    needs_review: 'Needs review',
  };

  const confidenceTone: Record<typeof confidenceTier, string> = {
    strong: 'border-green-500/40 bg-green-500/15 text-green-800',
    limited: 'border-amber-500/40 bg-amber-500/15 text-amber-800',
    needs_review: 'border-slate-500/40 bg-slate-500/15 text-slate-800',
  };

  return (
    <div className={`rounded-2xl border-2 ${meta.cardTone} p-6 sm:p-8`}>
      <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
        Recommended Next Step
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">
        {meta.headline}
      </h1>

      <div className="mt-3 flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${confidenceTone[confidenceTier]}`}
        >
          {confidenceLabel[confidenceTier]}
        </span>
      </div>

      <p className="mt-3 break-words text-base font-medium opacity-90 md:text-lg">
        <span className="font-semibold">Why:</span> {displayReason}
      </p>

      <p className="mt-4 text-sm font-semibold opacity-80">
        {evidence.sources.length > 0 && nba.evidenceCount > 0
          ? 'Based on verified sources and prior outcomes.'
          : evidence.sources.length > 0
            ? 'Based on verified sources — no prior employer outcomes yet.'
            : nba.evidenceCount > 0
              ? 'Based on prior outcomes only — no fresh source checks attached.'
              : 'No verified sources or prior outcomes yet — review manually.'}
      </p>

      {evidence.sources.length > 0 && (
        <p className="mt-3 text-xs opacity-75">
          Based on:{' '}
          <span className="font-semibold">{evidence.sources.join(', ')}</span>
        </p>
      )}

      {/* Learning hint — only rendered when the NBA engine has non-zero
          evidenceCount. The hint INFLUENCES prioritization (by surfacing
          historical pattern) but NEVER overrides the source-grounded
          decision above it. Rendered in muted secondary type so it never
          competes visually with the verified-source reason. */}
      {nba.evidenceCount > 0 && nba.action !== 'REVIEW_MANUALLY' && (
        <p className="mt-2 text-xs italic opacity-70">
          <span className="font-semibold not-italic">Context:</span>{' '}
          {nba.action === 'PROCEED'
            ? 'similar cases succeeded quickly.'
            : nba.action === 'ESCALATE'
              ? 'similar cases have been rejected before.'
              : 'similar cases have required additional verification.'}
        </p>
      )}

      <details className="mt-4 text-xs">
        <summary className="cursor-pointer list-none font-semibold opacity-75 hover:opacity-100">
          What shapes this signal?
        </summary>
        <ul className="mt-2 list-inside list-disc space-y-1 opacity-80">
          <li>Data completeness — how many decision-grade sources are attached</li>
          <li>Source freshness — when each source was last verified</li>
          <li>Prior outcomes — how similar cases have been handled</li>
        </ul>
      </details>

      <button
        type="button"
        onClick={handleClick}
        disabled={isDoing || isDone || !meta.backendAction}
        aria-busy={isDoing}
        className={`mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-xl border-2 px-6 py-3 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99] sm:w-auto ${meta.tone}`}
      >
        {isDoing ? meta.pending : isDone ? meta.done : meta.cta}
      </button>

      {consequence && (
        <p className="mt-3 text-xs opacity-75">{consequence}</p>
      )}
    </div>
  );
}
