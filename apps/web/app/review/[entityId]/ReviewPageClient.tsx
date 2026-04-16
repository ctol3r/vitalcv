import React from 'react';
import Link from 'next/link';
import ReviewClient from '@/components/review/ReviewClient';
import { Button } from '@/components/ui/button';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { getBackendBase } from '@/lib/api';
import type {
  EmployerAcceptanceHistoryResponse,
} from '@/lib/employer-review-actions';
import { normalizeEmployerAcceptanceHistoryResponse } from '@/lib/employer-review-actions';
import { normalizePassportData, type PassportData } from '@/lib/trust/passport-contract';
import { PUBLIC_WEDGE_ROUTE_TARGETS } from '@/lib/trust/public-wedge-parity';

const DEFAULT_REVIEW_ERROR = 'Employer review is unavailable for this packet.';

function logReviewPageError(message: string, details: Record<string, unknown>): void {
  console.error(`[ReviewPageClient] ${message}`, details);
}

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

type JsonFetchResult = {
  ok: boolean;
  body: unknown;
  errorDescription: string | null;
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

async function fetchBackendJson(
  path: string,
  init?: RequestInit,
): Promise<JsonFetchResult> {
  try {
    const response = await fetch(`${getBackendBase()}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const payload = await response.json().catch((error) => {
      logReviewPageError('Failed to parse backend JSON payload', {
        path,
        status: response.status,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    });

    return {
      ok: response.ok,
      body: response.ok ? payload : null,
      errorDescription: readErrorDescription(payload),
    };
  } catch (error) {
    logReviewPageError('Backend request failed', {
      path,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      body: null,
      errorDescription: null,
    };
  }
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
  const [passportResult, historyResult] = await Promise.all([
    fetchBackendJson(
      /^\d{10}$/.test(entityId)
        ? `/api/passport/npi/${encodeURIComponent(entityId)}`
        : `/api/passport/entity/${encodeURIComponent(entityId)}`,
    ),
    fetchBackendJson(
      `/api/employer-review/${encodeURIComponent(entityId)}/acceptance-history`,
    ),
  ]);

  const passport = passportResult.ok ? normalizePassportData(passportResult.body) : null;
  const acceptanceHistory =
    historyResult.ok
      ? (normalizeEmployerAcceptanceHistoryResponse(historyResult.body) ?? buildEmptyAcceptanceHistory())
      : buildEmptyAcceptanceHistory();

  if (passportResult.ok && !passport) {
    logReviewPageError('Passport payload failed normalization', {
      entityId,
    });
  }

  if (historyResult.ok && acceptanceHistory.history.length === 0 && historyResult.body !== null) {
    const normalizedHistory = normalizeEmployerAcceptanceHistoryResponse(historyResult.body);
    if (!normalizedHistory) {
      logReviewPageError('Acceptance history payload failed normalization', {
        entityId,
      });
    }
  }

  const retryHref = buildRetryHref({
    entityId,
    contextId,
    bundleId,
    from,
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
                : 'This clinician passport is not available for review yet. The clinician may need to run a readiness check first.'
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

  await fetch(`${getBackendBase()}/api/employer-review/${encodeURIComponent(entityId)}/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      organizationContextId: contextId ?? null,
      bundleId: bundleId ?? null,
      readinessScore: passport.readiness.score ?? null,
      blockers: passport.readiness.blockers ?? [],
    }),
  }).catch((error) => {
    logReviewPageError('Failed to record employer review view event', {
      entityId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  });

  return (
    <ReviewClient
      passport={passport}
      contextId={contextId}
      bundleId={bundleId}
      sharedBy={from}
      acceptanceHistory={acceptanceHistory}
    />
  );
}
