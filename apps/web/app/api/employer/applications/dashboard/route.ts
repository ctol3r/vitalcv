import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import {
  buildMarketplaceHeaders,
  MARKETPLACE_BACKEND,
} from '@/lib/server/marketplace-proxy';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(`${MARKETPLACE_BACKEND}/api/employer/applications/dashboard`, {
    headers: buildMarketplaceHeaders(session),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });

  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
