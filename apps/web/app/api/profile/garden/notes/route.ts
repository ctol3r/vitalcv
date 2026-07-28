import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { getApiBase } from '@/lib/api';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Career Garden notes proxy — clinician-private, identity from auth(),
 * NOT a caller-supplied header. Body text passes through untouched and the
 * backend status is returned as-is.
 */
async function proxy(req: NextRequest, method: 'GET' | 'POST') {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const base = getApiBase();
  if (!base) {
    return NextResponse.json({ error: 'Garden storage is not configured.' }, { status: 503 });
  }
  try {
    const res = await fetch(`${base}/api/profile/garden/notes`, {
      method,
      headers: await buildMarketplaceHeaders(
        session,
        method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      ),
      body: method === 'POST' ? await req.text() : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Garden storage is temporarily unavailable.' }, { status: 503 });
  }
}

export async function GET(req: NextRequest) {
  return proxy(req, 'GET');
}

export async function POST(req: NextRequest) {
  return proxy(req, 'POST');
}
