import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/api';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await auth();
  const body = await req.text();
  const headers = await buildMarketplaceHeaders(session, {
    'Content-Type': 'application/json',
  });

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

  const response = await fetch(`${getBackendBase()}/api/pilot-ops/feedback`, {
    method: 'POST',
    headers,
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });

  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}
