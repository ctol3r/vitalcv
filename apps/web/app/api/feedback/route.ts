import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getBackendBase } from '@/lib/api';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

export const runtime = 'nodejs';

function readRole(session: Awaited<ReturnType<typeof auth>>): string | null {
  const claims = session.sessionClaims as Record<string, unknown> | undefined;
  const vitalcv = claims?.vitalcv;
  const vitalcvRole = (
    vitalcv
    && typeof vitalcv === 'object'
    && 'role' in vitalcv
    && typeof vitalcv.role === 'string'
  )
    ? vitalcv.role
    : null;

  if (typeof claims?.role === 'string' && claims.role.length > 0) {
    return claims.role;
  }

  if (typeof claims?.org_role === 'string' && claims.org_role.length > 0) {
    return claims.org_role;
  }

  return vitalcvRole;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const headers = buildMarketplaceHeaders(session, {
    'Content-Type': 'application/json',
  });
  const role = readRole(session);

  if (role) {
    headers.set('x-clerk-user-role', role);
  }
  if (session.orgId) {
    headers.set('x-org-id', session.orgId);
  }

  const response = await fetch(`${getBackendBase()}/api/pilot-ops/feedback`, {
    method: 'POST',
    headers,
    body: await req.text(),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });

  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}
