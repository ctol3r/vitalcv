import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import {
  buildMarketplaceHeaders,
  MARKETPLACE_BACKEND,
} from '@/lib/server/marketplace-proxy';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { appId } = await params;
  const body = await req.text();
  const res = await fetch(`${MARKETPLACE_BACKEND}/api/applications/${appId}/review`, {
    method: 'PATCH',
    headers: await buildMarketplaceHeaders(session, { 'Content-Type': 'application/json' }),
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
