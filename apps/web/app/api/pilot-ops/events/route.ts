import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/api';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await auth();

  // HARDEN-PILOT-EVENTS-401:
  // Reject anonymous callers with HTTP 401. Without this gate, the
  // backend at apps/api/backend/src/routes/pilotOps.ts records the
  // event regardless of authentication — durable events with no
  // actor attribution. The fix lives at the proxy boundary so the
  // 401 surfaces to the caller before any backend round-trip; that
  // also means no backend record is created and no actor_id has to
  // be fabricated.
  //
  // x-cors-blocked is the OTHER 4xx surface the middleware can emit
  // for /api/* routes (apps/web/middleware.ts:108–125). 401 here
  // composes cleanly with that: a request that fails the CORS gate
  // never reaches this handler.
  if (!session.userId) {
    return NextResponse.json(
      {
        error: 'unauthorized',
        error_description:
          'POST /api/pilot-ops/events requires an authenticated Clerk session. Anonymous event writes are no longer accepted.',
      },
      { status: 401, headers: { 'x-pilot-events-anonymous': 'rejected' } },
    );
  }

  const body = await req.text();
  const headers = buildMarketplaceHeaders(session, {
    'Content-Type': 'application/json',
  });

  // Attach actor attribution explicitly. The marketplace headers
  // already include the Clerk user id, but emit the explicit
  // x-actor-id header so the backend's requestActorContext has a
  // stable, route-specific field for audit lineage on durable
  // pilot event rows.
  headers.set('x-actor-id', session.userId);

  const role = (session.sessionClaims as Record<string, unknown> | undefined)?.vitalcv;
  if (role && typeof role === 'object') {
    const roleValue = (role as Record<string, unknown>).role;
    if (typeof roleValue === 'string' && roleValue.length > 0) {
      headers.set('x-clerk-user-role', roleValue);
    }
  }

  if (session.orgId) {
    headers.set('x-org-id', session.orgId);
  }

  const response = await fetch(`${getBackendBase()}/api/pilot-ops/events`, {
    method: 'POST',
    headers,
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });

  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}
