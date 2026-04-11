import React from 'react';
import Link from 'next/link';
import ReviewClient from '@/components/review/ReviewClient';
import { Button } from '@/components/ui/button';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { getBackendBase } from '@/lib/api';
import type {
  EmployerAcceptanceHistoryResponse,
} from '@/lib/employer-review-actions';
import { passportToStreamSeed } from '@/lib/hybrid-loader/passportToStreamSeed';
import type { PassportData } from '@/lib/trust/passport-contract';
import { PUBLIC_WEDGE_ROUTE_TARGETS } from '@/lib/trust/public-wedge-parity';

const DEFAULT_REVIEW_ERROR = 'Employer review is unavailable for this packet.';

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
  body: T | null;
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
      body: response.ok ? payload as T : null,
      errorDescription: readErrorDescription(payload),
    };
  } catch {
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
    fetchBackendJson<PassportData>(
      /^\d{10}$/.test(entityId)
        ? `/api/passport/npi/${encodeURIComponent(entityId)}`
        : `/api/passport/entity/${encodeURIComponent(entityId)}`,
    ),
    fetchBackendJson<EmployerAcceptanceHistoryResponse>(
      `/api/employer-review/${encodeURIComponent(entityId)}/acceptance-history`,
    ),
  ]);

  const passport = passportResult.ok ? passportResult.body : null;
  const acceptanceHistory =
    historyResult.ok && historyResult.body
      ? historyResult.body
      : buildEmptyAcceptanceHistory();
  const retryHref = buildRetryHref({
    entityId,
    contextId,
    bundleId,
    from,
  });

  if (!passport) {
    return (
      <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <TrustStateCard
            eyebrow="Employer review"
            title="Employer review unavailable"
            description={(
              <>
                <span>{passportResult.errorDescription ?? DEFAULT_REVIEW_ERROR}</span>
                <span className="block pt-2 text-muted-foreground/60">
                  No decision card is rendered until VitalCV can hydrate a passport record for this entity. Shared review context must also still be valid when one is supplied.
                </span>
              </>
            )}
            tone="warning"
            centered
            actions={(
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild variant="outline" className="h-11 rounded-full border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Link href={retryHref}>Try again</Link>
                </Button>
                <Button asChild variant="ghost" className="h-11 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Link href={PUBLIC_WEDGE_ROUTE_TARGETS.homepageLookup}>Back to home</Link>
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
    body: JSON.stringify({
      organizationContextId: contextId ?? null,
      bundleId: bundleId ?? null,
      readinessScore: passport.readiness.score ?? null,
      blockers: passport.readiness.blockers ?? [],
    }),
  }).catch(() => null);

  // Hybrid-loader SSR→client bridge: compute the initial IngestStreamState on
  // the server from the authoritative PassportData. The client wrapper
  // (useHybridProviderData) uses this as its first-paint state and writes it
  // through to localStorage so subsequent visits render instantly.
  const hybridSeed = passportToStreamSeed(passport);

  return (
    <ReviewClient
      passport={passport}
      contextId={contextId}
      bundleId={bundleId}
      sharedBy={from}
      acceptanceHistory={acceptanceHistory}
      hybridSeed={hybridSeed}
    />
  );
}
