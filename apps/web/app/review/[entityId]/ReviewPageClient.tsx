import React from 'react';
import Link from 'next/link';
import ReviewClient from '@/components/review/ReviewClient';
import { Button } from '@/components/ui/button';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { getBackendBase } from '@/lib/api';
import type {
  EmployerAcceptanceHistoryResponse,
} from '@/lib/employer-review-actions';
import type { PassportData } from '@/lib/trust/passport-contract';
import { PUBLIC_WEDGE_ROUTE_TARGETS } from '@/lib/trust/public-wedge-parity';

const DEFAULT_REVIEW_ERROR = 'Review data unavailable.';

function buildEmptyAcceptanceHistory(): EmployerAcceptanceHistoryResponse {
  return {
    ok: true,
    summary: {
      acceptedOrganizationCount: 0,
      hasPriorAcceptances: false,
      headline: 'No prior acceptances',
      trustCopy: null,
    },
    history: [],
  };
}

interface ReviewPageClientProps {
  entityId: string;
  contextId?: string;
  bundleId?: string;
  from?: string;
}

type JsonFetchResult<T> = {
  ok: boolean;
  status: number;
  body: T | null;
  errorDescription: string | null;
};

type ShareTokenResolutionResponse = {
  ok: true;
  entityId: string;
  clinicianNpi: string;
  organizationContextId: string | null;
  bundleId: string | null;
  reviewHref: string;
  shareEventAuditId: string;
  sharedAt: string;
  expiresAt: string;
};

function readErrorDescription(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.error_description === 'string' && record.error_description.trim().length > 0) {
    return record.error_description;
  }
  if (typeof record.error === 'string' && record.error.trim().length > 0) {
    return record.error;
  }

  return null;
}

async function fetchBackendJson<T>(
  path: string,
  init?: RequestInit,
): Promise<JsonFetchResult<T>> {
  try {
    const response = await fetch(`${getBackendBase()}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => null);

    return {
      ok: response.ok,
      status: response.status,
      body: response.ok ? payload as T : null,
      errorDescription: readErrorDescription(payload),
    };
  } catch {
    return {
      ok: false,
      status: 0,
      body: null,
      errorDescription: null,
    };
  }
}

function isShareToken(value: string): boolean {
  return /^chk_[A-Za-z0-9_-]{43}$/.test(value);
}

function buildRetryHref(input: {
  entityId: string;
  contextId?: string;
  bundleId?: string;
  from?: string;
}): string {
  const query = new URLSearchParams({
    ...(input.contextId ? { contextId: input.contextId } : {}),
    ...(input.bundleId ? { bundleId: input.bundleId } : {}),
    ...(input.from ? { from: input.from } : {}),
  }).toString();

  return `/review/${input.entityId}${query ? `?${query}` : ''}`;
}

export default async function ReviewPageClient({
  entityId,
  contextId,
  bundleId,
  from,
}: ReviewPageClientProps) {
  let resolvedEntityId = entityId;
  let resolvedContextId = contextId;
  let resolvedBundleId = bundleId;
  let resolvedFrom = from;

  if (isShareToken(entityId)) {
    const tokenResult = await fetchBackendJson<ShareTokenResolutionResponse>(
      `/api/employer-review/share-token/${encodeURIComponent(entityId)}`,
    );

    if (!tokenResult.ok || !tokenResult.body?.ok) {
      const isExpired = tokenResult.status === 410;
      return (
        <main
          data-testid="share-token-unresolved"
          data-share-token-status={isExpired ? 'expired' : 'missing'}
          className="min-h-screen bg-background flex flex-col items-center justify-center px-4"
        >
          <div className="w-full max-w-sm">
            <TrustStateCard
              eyebrow="Employer review"
              title="Review link unavailable"
              description={
                isExpired
                  ? 'This review link has expired. Ask the clinician to share a fresh packet.'
                  : 'This review link is missing, expired, or no longer maps to an active packet.'
              }
              tone="warning"
              centered
              actions={(
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button asChild variant="ghost" className="h-11 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Link href={PUBLIC_WEDGE_ROUTE_TARGETS.reviewEntry}>Back to review</Link>
                  </Button>
                </div>
              )}
            />
          </div>
        </main>
      );
    }

    resolvedEntityId = tokenResult.body.entityId;
    resolvedContextId = tokenResult.body.organizationContextId ?? contextId;
    resolvedBundleId = tokenResult.body.bundleId ?? bundleId;
    resolvedFrom = from ?? 'VitalCV packet share';
  }

  const [passportResult, historyResult] = await Promise.all([
    fetchBackendJson<PassportData>(
      /^\d{10}$/.test(resolvedEntityId)
        ? `/api/passport/npi/${encodeURIComponent(resolvedEntityId)}`
        : `/api/passport/entity/${encodeURIComponent(resolvedEntityId)}`,
    ),
    fetchBackendJson<EmployerAcceptanceHistoryResponse>(
      `/api/employer-review/${encodeURIComponent(resolvedEntityId)}/acceptance-history`,
    ),
  ]);

  const passport = passportResult.ok ? passportResult.body : null;
  const acceptanceHistory =
    historyResult.ok && historyResult.body
      ? historyResult.body
      : buildEmptyAcceptanceHistory();
  const retryHref = buildRetryHref({
    entityId: resolvedEntityId,
    contextId: resolvedContextId,
    bundleId: resolvedBundleId,
    from: resolvedFrom,
  });

  if (!passport) {
    const isOrgError = passportResult.errorDescription?.includes('organization_context') ?? false;
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <TrustStateCard
            eyebrow="Employer review"
            title={isOrgError ? 'Set up employer workspace' : 'Employer review unavailable'}
            description={
              isOrgError
                ? 'Sign in and configure your employer workspace to access the full review surface.'
                : 'This clinician record is not available for review yet. The clinician may need to run a readiness check first.'
            }
            tone="warning"
            centered
            actions={(
              <div className="flex flex-wrap items-center justify-center gap-3">
                {isOrgError ? (
                  <Button asChild variant="default" className="h-11 rounded-full">
                    <Link href="/sign-in?redirect_url=/review">Sign in</Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline" className="h-11 rounded-full border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Link href={retryHref}>Try again</Link>
                  </Button>
                )}
                <Button asChild variant="ghost" className="h-11 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Link href={PUBLIC_WEDGE_ROUTE_TARGETS.reviewEntry}>Back to review</Link>
                </Button>
              </div>
            )}
          />
        </div>
      </main>
    );
  }

  await fetch(`${getBackendBase()}/api/employer-review/${encodeURIComponent(resolvedEntityId)}/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      organizationContextId: resolvedContextId ?? null,
      bundleId: resolvedBundleId ?? null,
      readinessScore: passport.readiness.score ?? null,
      blockers: passport.readiness.blockers ?? [],
    }),
  }).catch(() => null);

  return (
    <ReviewClient
      passport={passport}
      contextId={resolvedContextId}
      bundleId={resolvedBundleId}
      sharedBy={resolvedFrom}
      acceptanceHistory={acceptanceHistory}
    />
  );
}
