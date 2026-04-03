'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ReviewClient from '@/components/review/ReviewClient';
import { Button } from '@/components/ui/button';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import {
  fetchPassportEntity,
  fetchReviewAcceptanceHistory,
  fireEmployerReviewOpened,
} from '@/lib/api';
import type {
  EmployerAcceptanceHistoryResponse,
} from '@/lib/employer-review-actions';
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

export default function ReviewPageClient({
  entityId,
  contextId,
  bundleId,
  from,
}: ReviewPageClientProps) {
  const [passport, setPassport] = useState<PassportData | null>(null);
  const [acceptanceHistory, setAcceptanceHistory] = useState<EmployerAcceptanceHistoryResponse>(
    buildEmptyAcceptanceHistory(),
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);

      const [passportResult, historyResult] = await Promise.all([
        fetchPassportEntity(entityId),
        fetchReviewAcceptanceHistory(entityId),
      ]);

      if (cancelled) {
        return;
      }

      setPassport(passportResult.ok ? passportResult.body : null);
      setAcceptanceHistory(
        historyResult.ok && historyResult.body
          ? historyResult.body
          : buildEmptyAcceptanceHistory(),
      );
      setErrorMessage(passportResult.ok ? null : DEFAULT_REVIEW_ERROR);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [entityId]);

  useEffect(() => {
    if (!passport) return;

    void fireEmployerReviewOpened(entityId, {
      organizationContextId: contextId ?? null,
      bundleId: bundleId ?? null,
      readinessScore: passport.readiness.score ?? null,
      blockers: passport.readiness.blockers ?? [],
    });
  }, [bundleId, contextId, entityId, passport]);

  const retryHref = `/review/${entityId}${contextId || bundleId || from
    ? `?${new URLSearchParams({
        ...(contextId ? { contextId } : {}),
        ...(bundleId ? { bundleId } : {}),
        ...(from ? { from } : {}),
      }).toString()}`
    : ''}`;

  if (loading) {
    return <ReviewClient loading entityId={entityId} />;
  }

  if (!passport) {
    return (
      <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <TrustStateCard
            eyebrow="Employer review"
            title="Employer review unavailable"
            description={(
              <>
                <span>{errorMessage ?? DEFAULT_REVIEW_ERROR}</span>
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
