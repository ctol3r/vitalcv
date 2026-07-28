import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { getApiBase } from '@/lib/api';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const base = getApiBase();
  if (!base) {
    return NextResponse.json({ error: 'Garden storage is not configured.' }, { status: 503 });
  }
  try {
    const res = await fetch(`${base}/api/profile/garden/cv`, {
      headers: await buildMarketplaceHeaders(session),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Garden storage is temporarily unavailable.' }, { status: 503 });
  }
}
