/**
 * GET /api/ops-engine/snapshot — authed, org-scoped live snapshot for the
 * Operations Engine. Used by the /ops/engine client to poll for a live feel
 * without a page reload. Returns 401 when unauthenticated; never returns mock
 * data (the snapshot reports an honest status when no source is connected).
 */
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOpsEngineSnapshot } from '@/lib/ops-engine/getOpsEngineSnapshot';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const snapshot = await getOpsEngineSnapshot({
    userId: session.userId,
    orgId: session.orgId ?? null,
    session,
  });
  return NextResponse.json(snapshot, {
    headers: { 'cache-control': 'no-store' },
  });
}
