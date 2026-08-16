/**
 * POST /api/ops-engine/action — authed proxy for real Operations Engine write
 * actions. Forwards the operator's Clerk identity to the backend's gated
 * employer workflow endpoint, which performs the real audited mutation
 * (writes an AuditEvent). apps/web never mutates records directly — the backend
 * is the system of record.
 *
 * Body: { applicationId: string, action: 'accept'|'request_info'|'reject',
 *         reviewNote?: string, requests?: { field: string; message: string }[] }
 */
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getBackendBase } from '@/lib/api';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

export const dynamic = 'force-dynamic';

// 'accept' is deliberately absent: head-start acceptance is packet-bound and
// belongs to the employer decision surface, never an ops console. The backend
// rejects a bare accept anyway; this keeps ops-engine from ever offering one.
const ACTIONS = new Set(['request_info', 'reject']);

export async function POST(req: Request) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: {
    applicationId?: string;
    action?: string;
    reviewNote?: string;
    requests?: { field: string; message: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { applicationId, action, reviewNote, requests } = body;
  if (!applicationId || !action || !ACTIONS.has(action)) {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }

  const base = getBackendBase();
  if (!base) {
    return NextResponse.json({ error: 'backend_unavailable' }, { status: 503 });
  }

  try {
    const res = await fetch(
      `${base}/api/applications/${encodeURIComponent(applicationId)}/workflow-action`,
      {
        method: 'POST',
        headers: await buildMarketplaceHeaders(session, { 'content-type': 'application/json' }),
        body: JSON.stringify({ action, reviewNote, requests }),
        cache: 'no-store',
      },
    );
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'backend_error', detail: err instanceof Error ? err.message : 'error' },
      { status: 502 },
    );
  }
}
