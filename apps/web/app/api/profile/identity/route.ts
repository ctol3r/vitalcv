/**
 * GET /api/profile/identity — the signed-in clinician's derived identity tier
 * and the exact signals behind it. Thin auth-scoped proxy.
 */
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getApiBase } from '@/lib/api';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const headers = await buildIdentityHeaders({ userId: session.userId });
  const res = await fetch(`${getApiBase()}/api/profile/identity`, {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
  return NextResponse.json(data, { status: res.status });
}
