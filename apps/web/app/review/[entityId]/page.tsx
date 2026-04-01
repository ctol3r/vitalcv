import React from 'react';
import Link from 'next/link';
import ReviewClient from '@/components/review/ReviewClient';
import { Button } from '@/components/ui/button';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import type { EmployerAcceptanceHistoryResponse } from '@/lib/employer-review-actions';
import type { PassportData } from '@/lib/trust/passport-contract';
import { PUBLIC_WEDGE_ROUTE_TARGETS } from '@/lib/trust/public-wedge-parity';

export const dynamic = 'force-dynamic';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

const DEFAULT_REVIEW_ERROR = 'Employer review is unavailable for this packet.';

interface ReviewPageData {
  passport: PassportData | null;
  acceptanceHistory: EmployerAcceptanceHistoryResponse;
  errorMessage: string | null;
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

async function fetchAcceptanceHistory(entityId: string): Promise<EmployerAcceptanceHistoryResponse> {
  try {
    const res = await fetch(`${B}/api/employer-review/${entityId}/acceptance-history`, { cache: 'no-store' });
    if (res.ok) {
      return await res.json() as EmployerAcceptanceHistoryResponse;
    }
  } catch {
    // Fall through to empty state.
  }

  return buildEmptyAcceptanceHistory();
}

async function fetchReviewPageData(entityId: string): Promise<ReviewPageData> {
  try {
    const res = await fetch(`${B}/api/passport/entity/${entityId}`, { cache: 'no-store' });
    if (res.ok) {
      const passport = await res.json() as PassportData;
      return {
        passport,
        acceptanceHistory: await fetchAcceptanceHistory(entityId),
        errorMessage: null,
      };
    }

    const data = await res.json().catch(() => ({})) as {
      error?: string;
      error_description?: string;
    };

    return {
      passport: null,
      acceptanceHistory: buildEmptyAcceptanceHistory(),
      errorMessage: data.error_description ?? data.error ?? DEFAULT_REVIEW_ERROR,
    };
  } catch {
    return {
      passport: null,
      acceptanceHistory: buildEmptyAcceptanceHistory(),
      errorMessage: DEFAULT_REVIEW_ERROR,
    };
  }
}

/** Fire the employer-review-opened event for KPI tracking (fire-and-forget). */
async function fireReviewOpenedEvent(
  entityId: string,
  passport: { readiness: { score?: number; blockers?: string[] } } | null,
  contextId?: string,
  bundleId?: string,
): Promise<void> {
  // POST /api/employer-review/:entityId/view — always 202, non-blocking
  try {
    await fetch(`${B}/api/employer-review/${entityId}/view`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        organizationContextId: contextId ?? null,
        bundleId:              bundleId ?? null,
        readinessScore:        passport?.readiness?.score ?? null,
        blockers:              passport?.readiness?.blockers ?? [],
      }),
      // Short timeout — never block page render on this
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Intentionally swallowed — KPI capture must never fail the review page
  }
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params:       Promise<{ entityId: string }>;
  searchParams: Promise<{ contextId?: string; bundleId?: string; from?: string }>;
}) {
  const { entityId }                    = await params;
  const { contextId, bundleId, from }   = await searchParams;
  const { passport, acceptanceHistory, errorMessage } = await fetchReviewPageData(entityId);
  const retryHref = `/review/${entityId}${contextId || bundleId || from
    ? `?${new URLSearchParams({
        ...(contextId ? { contextId } : {}),
        ...(bundleId  ? { bundleId  } : {}),
        ...(from      ? { from      } : {}),
      }).toString()}`
    : ''}`;

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
                <span className="block pt-2 text-white/30">
                  No decision card is rendered until VitalCV can hydrate a passport record for this entity. Shared review context must also still be valid when one is supplied.
                </span>
              </>
            )}
            tone="warning"
            centered
            actions={(
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild variant="outline" className="h-11 rounded-full border-white/10 bg-white/4 text-white/70 hover:border-white/20 hover:bg-white/8 hover:text-white">
                  <Link href={retryHref}>Try again</Link>
                </Button>
                <Button asChild variant="ghost" className="h-11 rounded-full text-white/45 hover:bg-white/5 hover:text-white/70">
                  <Link href={PUBLIC_WEDGE_ROUTE_TARGETS.homepageLookup}>Back to home</Link>
                </Button>
              </div>
            )}
          />
        </div>
      </main>
    );
  }

  // KPI: record employer review open — fire-and-forget, never blocks render
  void fireReviewOpenedEvent(entityId, passport, contextId, bundleId);

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
