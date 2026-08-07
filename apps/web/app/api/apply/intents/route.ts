import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { getBackendBase } from '@/lib/api';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Verified employer sign-in required.' }, { status: 401 });
  }
  try {
    const response = await fetch(`${getBackendBase()}/api/apply/intents`, {
      method: 'POST',
      headers: await buildMarketplaceHeaders(session, { 'Content-Type': 'application/json' }),
      body: await request.text(),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    const data = await response.json().catch(() => ({ error: 'Apply Intent response unavailable.' }));
    return NextResponse.json(data, {
      status: response.status,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json(
      { error: 'Apply Intent service unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
