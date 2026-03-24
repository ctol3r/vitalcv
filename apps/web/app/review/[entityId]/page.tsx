import Link from 'next/link';
import ReviewClient from '@/components/review/ReviewClient';
import type { PassportData } from '@/app/passport/[id]/page';

export const dynamic = 'force-dynamic';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

const DEFAULT_REVIEW_ERROR = 'Employer review is unavailable for this packet.';

interface ReviewPageData {
  passport: PassportData | null;
  errorMessage: string | null;
}

async function fetchReviewPageData(entityId: string): Promise<ReviewPageData> {
  try {
    const res = await fetch(`${B}/api/passport/entity/${entityId}`, { cache: 'no-store' });
    if (res.ok) {
      return {
        passport: await res.json() as PassportData,
        errorMessage: null,
      };
    }

    const data = await res.json().catch(() => ({})) as {
      error?: string;
      error_description?: string;
    };

    return {
      passport: null,
      errorMessage: data.error_description ?? data.error ?? DEFAULT_REVIEW_ERROR,
    };
  } catch {
    return {
      passport: null,
      errorMessage: DEFAULT_REVIEW_ERROR,
    };
  }
}

/** Fire the employer-review-opened event for KPI tracking (fire-and-forget). */
async function fireReviewOpenedEvent(
  entityId: string,
  passport: { readiness: { score?: number; blockers?: string[] } } | null,
  contextId?: string,
): Promise<void> {
  // POST /api/employer-review/:entityId/view — always 202, non-blocking
  try {
    await fetch(`${B}/api/employer-review/${entityId}/view`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        organizationContextId: contextId ?? null,
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
  searchParams: Promise<{ contextId?: string; from?: string }>;
}) {
  const { entityId }          = await params;
  const { contextId, from }   = await searchParams;
  const { passport, errorMessage } = await fetchReviewPageData(entityId);
  const retryHref = `/review/${entityId}${contextId || from
    ? `?${new URLSearchParams({
        ...(contextId ? { contextId } : {}),
        ...(from ? { from } : {}),
      }).toString()}`
    : ''}`;

  if (!passport) {
    return (
      <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-5 text-center">
          <p className="text-white/60 text-sm font-medium">Employer review unavailable</p>
          <p className="mt-2 text-xs leading-relaxed text-white/38">
            {errorMessage ?? DEFAULT_REVIEW_ERROR}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-white/28">
            No decision card is rendered until VitalCV can hydrate a passport record for this entity. Shared review context must also still be valid when one is supplied.
          </p>
          <div className="mt-4 flex items-center justify-center gap-4">
            <Link href={retryHref} className="inline-flex text-white/52 text-xs underline underline-offset-2">
              Try again
            </Link>
            <Link href="/" className="inline-flex text-white/40 text-xs underline underline-offset-2">
              Back to home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // KPI: record employer review open — fire-and-forget, never blocks render
  void fireReviewOpenedEvent(entityId, passport, contextId);

  return (
    <ReviewClient
      passport={passport}
      contextId={contextId}
      sharedBy={from}
    />
  );
}
