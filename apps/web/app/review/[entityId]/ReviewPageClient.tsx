import React from 'react';
import Link from 'next/link';
import ReviewClient from '@/components/review/ReviewClient';
import { Button } from '@/components/ui/button';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { getBackendBase } from '@/lib/api';
import { normalizeEmployerAcceptanceHistoryResponse } from '@/lib/employer-review-actions';
import type { PassportData } from '@/lib/trust/passport-contract';

interface ReviewPageClientProps {
  entityId: string;
  contextId?: string;
  bundleId?: string;
  applicationId?: string;
  from?: string;
}

function buildRetryHref(input: {
  entityId: string;
  contextId?: string;
  bundleId?: string;
  from?: string;
}): string {
  const params = new URLSearchParams();
  if (input.contextId) params.set('contextId', input.contextId);
  if (input.bundleId) params.set('bundleId', input.bundleId);
  if (input.from) params.set('from', input.from);
  const query = params.toString();
  return `/review/${input.entityId}${query ? `?${query}` : ''}`;
}

export default async function ReviewPageClient({
  entityId,
  contextId,
  bundleId,
  from,
}: ReviewPageClientProps) {
  const passportRes = await fetch(
    `${getBackendBase()}/api/entity/${encodeURIComponent(entityId)}/passport`,
    { cache: 'no-store' },
  ).catch(() => null);

  if (!passportRes?.ok) {
    const retryHref = buildRetryHref({ entityId, contextId, bundleId, from });

    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <TrustStateCard
            title="Employer review unavailable"
            description="This clinician passport is not available for review yet."
            actions={(
              <Button asChild variant="outline">
                <Link href={retryHref}>Try again</Link>
              </Button>
            )}
          />
        </div>
      </main>
    );
  }

  const passport = await passportRes.json() as PassportData;

  const [acceptanceRes] = await Promise.all([
    fetch(
      `${getBackendBase()}/api/employer-review/${encodeURIComponent(entityId)}/acceptance-history`,
      { cache: 'no-store' },
    ).catch(() => null),
    fetch(
      `${getBackendBase()}/api/employer-review/${encodeURIComponent(entityId)}/view`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          organizationContextId: contextId ?? null,
          bundleId: bundleId ?? null,
          readinessScore: passport.readiness.score,
          blockers: passport.readiness.blockers,
        }),
      },
    ).catch(() => null),
  ]);

  const acceptanceBody = await acceptanceRes?.json().catch(() => null);
  const acceptanceHistory = normalizeEmployerAcceptanceHistoryResponse(acceptanceBody) ?? undefined;

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
