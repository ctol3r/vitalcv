/**
 * /api/track/apply — Actor-attributed apply event proxy.
 *
 * Enforces Clerk authentication before forwarding APPLY_CLICKED events
 * to the backend. No anonymous durable write may pass through this route.
 *
 * Actor continuity is guaranteed:
 *   - 401 returned for any unauthenticated request
 *   - x-clerk-user-id injected into every backend write
 *   - actor_id attached to event metadata for replay lineage
 */

import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/api';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

export const runtime = 'nodejs';

/** The only event type this route accepts. Narrows blast radius. */
const ACCEPTED_EVENT_TYPE = 'APPLY_CLICKED';

export async function POST(req: NextRequest) {
  const session = await auth();

  // ── Actor continuity enforcement ─────────────────────────────────────────
  // APPLY_CLICKED is a durable write. No anonymous actor may trigger it.
  if (!session.userId) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        error_description: 'Authenticated actor required for apply event writes.',
      },
      { status: 401 },
    );
  }

  let body: {
    type?: string;
    providerId?: string;
    jobId?: string;
    employerId?: string;
    metadata?: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // ── Event type guard ──────────────────────────────────────────────────────
  if (body.type !== ACCEPTED_EVENT_TYPE) {
    return NextResponse.json(
      {
        error: 'invalid_event_type',
        error_description: `This endpoint only accepts ${ACCEPTED_EVENT_TYPE} events.`,
      },
      { status: 400 },
    );
  }

  if (!body.providerId?.trim()) {
    return NextResponse.json(
      { error: 'missing_provider_id', error_description: 'providerId is required.' },
      { status: 400 },
    );
  }

  // ── Replay lineage: attach actor_id to metadata ───────────────────────────
  const enrichedBody = {
    ...body,
    metadata: {
      ...(body.metadata ?? {}),
      actor_id: session.userId,
    },
  };

  const headers = await buildMarketplaceHeaders(session, {
    'Content-Type': 'application/json',
  });

  try {
    const response = await fetch(`${getBackendBase()}/api/learning/track`, {
      method: 'POST',
      headers,
      body: JSON.stringify(enrichedBody),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });

    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: 'Track endpoint temporarily unavailable.' },
      { status: 503 },
    );
  }
}
