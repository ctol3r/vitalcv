/**
 * GET /api/admin/agent-ops — Start Agent decision-ledger report (ADMIN only).
 * Powers /admin/agent-ops and any external monitor. Read-only.
 */
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { buildAgentOpsReport } from '@/lib/agent/ops/agent-ops-report';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const role = (session.sessionClaims as { vitalcv?: { role?: string } } | null)?.vitalcv?.role;
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const report = await buildAgentOpsReport();
  return NextResponse.json(report, { status: 200 });
}
