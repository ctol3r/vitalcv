import Link from 'next/link';
import ReviewClient from '@/components/review/ReviewClient';
import type { PassportData } from '@/app/passport/[id]/page';

export const dynamic = 'force-dynamic';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

async function fetchPassport(entityId: string): Promise<PassportData | null> {
  try {
    const res = await fetch(`${B}/api/passport/entity/${entityId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json() as PassportData;
  } catch { return null; }
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
  const passport               = await fetchPassport(entityId);

  if (!passport) {
    return (
      <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center justify-center px-4">
        <p className="text-white/35 text-sm">Provider not found.</p>
        <Link href="/" className="text-white/40 text-xs mt-4 underline underline-offset-2">
          Back to home
        </Link>
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
