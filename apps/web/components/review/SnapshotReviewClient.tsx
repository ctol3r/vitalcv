'use client';

import React, { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRoleContext } from '@/components/auth/RoleContext';
import { ApplyBundleView, type ApplyBundle } from '@/components/apply/ApplyBundleView';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  CLERK_PROVIDER_ENABLED,
  CLERK_SIGN_IN_URL,
} from '@/lib/auth/clerkConfig';
import { getDecisionSummary } from '@/lib/apply/decision-summary';
import {
  type EmployerReviewActionResponse,
} from '@/lib/employer-review-actions';

interface SnapshotReviewClientProps {
  bundle: ApplyBundle;
  entityId: string;
  contextId?: string;
  applicationId: string;
  bundleId: string;
}

type ActionState =
  | { phase: 'idle' }
  | { phase: 'loading'; intent: 'accept' | 'refresh' | 'review' }
  | {
      phase: 'done';
      intent: 'accept' | 'refresh' | 'review';
      title: string;
      changed: string;
      next: string;
      backendMessage: string;
    }
  | { phase: 'error'; message: string };

function buildSignInHref(entityId: string, input: {
  contextId?: string;
  applicationId: string;
  bundleId: string;
}): string {
  const params = new URLSearchParams();

  if (input.contextId) {
    params.set('contextId', input.contextId);
  }
  params.set('applicationId', input.applicationId);
  params.set('bundleId', input.bundleId);

  return `${CLERK_SIGN_IN_URL}?redirect_url=${encodeURIComponent(`/review/${entityId}?${params.toString()}`)}`;
}

function describeAction(intent: 'accept' | 'refresh' | 'review'): {
  title: string;
  description: string;
} {
  switch (intent) {
    case 'accept':
      return {
        title: 'Accept as head start',
        description: 'Proceed with the current evidence exactly as shown here. This records a head start, not final clearance.',
      };
    case 'refresh':
      return {
        title: 'Request refresh',
        description: 'Re-run incomplete or stale sources and create a new snapshot before relying further.',
      };
    case 'review':
    default:
      return {
        title: 'Route to review',
        description: 'Escalate this application to manual credentialing review instead of deciding from partial evidence.',
      };
  }
}

function describeLoading(intent: 'accept' | 'refresh' | 'review'): string {
  switch (intent) {
    case 'accept':
      return 'Recording a head-start decision against the shared evidence…';
    case 'refresh':
      return 'Recording a refresh request for the incomplete checks shown here…';
    case 'review':
    default:
      return 'Recording a manual credentialing review request for this evidence…';
  }
}

function describeSuccess(
  intent: 'accept' | 'refresh' | 'review',
  backendMessage: string,
): Extract<ActionState, { phase: 'done' }> {
  switch (intent) {
    case 'accept':
      return {
        phase: 'done',
        intent,
        title: 'Head start recorded',
        changed: 'This employer decision was recorded against the exact evidence now on screen.',
        next: 'Proceed with the current evidence, or route to manual credentialing review if more evidence is still required.',
        backendMessage,
      };
    case 'refresh':
      return {
        phase: 'done',
        intent,
        title: 'Refresh requested',
        changed: 'Incomplete or stale checks were flagged for a new snapshot run.',
        next: 'Wait for the refreshed snapshot before relying further on this application.',
        backendMessage,
      };
    case 'review':
    default:
      return {
        phase: 'done',
        intent,
        title: 'Manual review requested',
        changed: 'This application was escalated out of the self-serve decision path.',
        next: 'Hand this case to credentialing review and wait for a reviewed outcome before proceeding.',
        backendMessage,
      };
  }
}

function decisionHeadline(status: ApplyBundle['status']): {
  label: string;
  detail: string;
} {
  switch (status) {
    case 'ready':
      return {
        label: 'Ready to move forward',
        detail: 'The evidence shown here is sufficient to keep moving from this shared review snapshot.',
      };
    case 'blocked':
      return {
        label: 'Not ready to move forward',
        detail: 'A confirmed blocker in this shared review snapshot must be resolved before start.',
      };
    case 'unknown':
      return {
        label: 'Not ready yet',
        detail: 'No verified source evidence is attached yet, so this review cannot support a decision.',
      };
    case 'partial':
    default:
      return {
        label: 'Not ready yet',
        detail: 'Some evidence is attached, but this shared review snapshot still has limitations that need follow-up.',
      };
  }
}

async function postSnapshotAction(
  entityId: string,
  endpoint: 'accept' | 'request-refresh' | 'route-to-review',
  body: Record<string, unknown>,
): Promise<EmployerReviewActionResponse> {
  const response = await fetch(`/api/employer-review/${encodeURIComponent(entityId)}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({})) as {
    error?: string;
    error_description?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error_description ?? payload.error ?? `Action failed (${response.status})`);
  }

  return payload as EmployerReviewActionResponse;
}

export default function SnapshotReviewClient({
  bundle,
  entityId,
  contextId,
  applicationId,
  bundleId,
}: SnapshotReviewClientProps) {
  const { isLoaded, isSignedIn, isEmployer } = useRoleContext();
  const [actionState, setActionState] = useState<ActionState>({ phase: 'idle' });
  const summary = useMemo(() => getDecisionSummary({
    status: bundle.status ?? 'unknown',
    blockers: bundle.blockers ?? [],
    nextAction: bundle.nextAction ?? null,
    snapshot: {
      claims: (bundle.snapshot?.claims ?? []).map((c) => ({
        credentialType: c.credentialType,
        issuer: c.issuer,
        status: c.status,
      })),
      limitations: (bundle.snapshot?.limitations ?? []).map((l) => ({
        state: l.state,
        label: l.label,
        detail: l.detail,
      })),
    },
  }), [bundle]);
  const headline = useMemo(() => decisionHeadline(bundle.status ?? 'partial'), [bundle.status]);
  const canPersistActions = !CLERK_PROVIDER_ENABLED || (isLoaded && isSignedIn && isEmployer);
  const signInHref = buildSignInHref(entityId, { contextId, applicationId, bundleId });

  async function runAction(intent: 'accept' | 'refresh' | 'review') {
    if (!canPersistActions) {
      return;
    }

    setActionState({ phase: 'loading', intent });
    try {
      const payload = {
        organizationContextId: contextId ?? null,
        applicationId,
        bundleId,
      };
      const result = intent === 'accept'
        ? await postSnapshotAction(entityId, 'accept', {
            ...payload,
            acceptanceScope: 'partial',
            acceptanceReason: 'Accepted from immutable application snapshot as a head start.',
          })
        : intent === 'refresh'
          ? await postSnapshotAction(entityId, 'request-refresh', {
              ...payload,
              staleSources: bundle.snapshot?.sourceCoverage?.summary?.stale ?? [],
              missingDomains: summary.missing,
              message: 'Refresh requested from immutable application snapshot.',
            })
          : await postSnapshotAction(entityId, 'route-to-review', {
              ...payload,
              reason: 'Escalated from immutable application snapshot.',
              priority: summary.state === 'blocked' ? 'HIGH' : 'NORMAL',
            });

      setActionState(describeSuccess(intent, result.state.summary.description));
    } catch (error) {
      setActionState({
        phase: 'error',
        message: error instanceof Error ? error.message : 'The employer action could not be recorded.',
      });
    }
  }

  return (
    <div className="bg-vt-surface-ops-base">
      <ApplyBundleView bundle={bundle} footerHref={null} footerLabel={null} />

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-24">
        <Card className="gap-4 rounded-2xl border-white/8 bg-white/[0.03] px-5 py-5 shadow-none">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
              Can this clinician move forward?
            </p>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">{headline.label}</h2>
              <p className="text-sm text-foreground/80">{headline.detail}</p>
            </div>
            <p className="text-sm text-foreground">
              This review uses the exact evidence that was shared here. It does not refresh behind the scenes.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <SummaryList title="Verified now" items={summary.proven} emptyLabel="No verified claims are attached in this snapshot." />
            <SummaryList title="Still missing" items={summary.missing} emptyLabel="No remaining limitations are listed in this snapshot." />
            <SummaryList title="Blocks start" items={summary.blockers} emptyLabel="No blocking evidence is attached in this snapshot." />
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">What to do next</p>
            <p className="mt-1 text-sm text-foreground">{summary.nextAction}</p>
          </div>
        </Card>

        <Card className="gap-4 rounded-2xl border-white/8 bg-white/[0.03] px-5 py-5 shadow-none">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
              Record the next step
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Every action is recorded against this shared evidence with a timestamp and evidence hash. Actions do not read fresh entity state.
            </p>
          </div>

          <div className="grid gap-3">
            <ActionExplanation
              title={describeAction('accept').title}
              description={describeAction('accept').description}
              action={(
                <Button
                  onClick={() => runAction('accept')}
                  disabled={!canPersistActions || bundle.status === 'blocked' || actionState.phase === 'loading'}
                  variant="success"
                  className="h-11 rounded-xl text-xs font-semibold uppercase tracking-widest"
                >
                  {actionState.phase === 'loading' && actionState.intent === 'accept'
                    ? 'Recording acceptance…'
                    : 'Accept as head start'}
                </Button>
              )}
            />
            <ActionExplanation
              title={describeAction('refresh').title}
              description={describeAction('refresh').description}
              action={(
                <Button
                  onClick={() => runAction('refresh')}
                  disabled={!canPersistActions || actionState.phase === 'loading'}
                  variant="outline"
                  className="h-11 rounded-xl border-border bg-white/[0.03] text-xs font-semibold uppercase tracking-widest"
                >
                  {actionState.phase === 'loading' && actionState.intent === 'refresh'
                    ? 'Recording refresh…'
                    : 'Request refresh'}
                </Button>
              )}
            />
            <ActionExplanation
              title={describeAction('review').title}
              description={describeAction('review').description}
              action={(
                <Button
                  onClick={() => runAction('review')}
                  disabled={!canPersistActions || actionState.phase === 'loading'}
                  variant="outline"
                  className="h-11 rounded-xl border-border bg-white/[0.03] text-xs font-semibold uppercase tracking-widest"
                >
                  {actionState.phase === 'loading' && actionState.intent === 'review'
                    ? 'Recording review route…'
                    : 'Route to review'}
                </Button>
              )}
            />
          </div>

          {!canPersistActions ? (
            <Link
              href={signInHref}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/8 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-white/[0.05]"
            >
              Sign in with an employer workspace to continue
            </Link>
          ) : null}

          {actionState.phase === 'loading' ? (
            <p aria-live="polite" className="text-xs text-foreground/70">
              {describeLoading(actionState.intent)}
            </p>
          ) : null}
          {actionState.phase === 'done' ? (
            <div
              aria-live="polite"
              className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3"
            >
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">
                What just happened
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">{actionState.title}</p>
              <p className="mt-2 text-xs text-foreground/70">{actionState.changed}</p>
              <p className="mt-2 text-xs text-muted-foreground">{actionState.backendMessage}</p>
              <p className="mt-2 text-xs text-foreground/70">Next: {actionState.next}</p>
            </div>
          ) : null}
          {actionState.phase === 'error' ? (
            <p className="text-xs text-[var(--vt-critical)]">{actionState.message}</p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

function SummaryList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">{title}</p>
      <div className="mt-2 space-y-2">
        {items.length > 0 ? items.map((item) => (
          <p key={item} className="text-xs text-foreground/70">{item}</p>
        )) : (
          <p className="text-xs text-muted-foreground">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}

function ActionExplanation({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-3">{action}</div>
    </div>
  );
}
