/**
 * GET /api/ops/snapshot
 *
 * Operator dashboard JSON snapshot. Protected — requires Clerk auth.
 * Returns full OperatorDashboardSnapshot with Cache-Control: no-store.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOperatorDashboardSnapshot } from '@/lib/ops/getOperatorDashboardSnapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();

  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const snapshot = await getOperatorDashboardSnapshot();

  return NextResponse.json(snapshot, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
