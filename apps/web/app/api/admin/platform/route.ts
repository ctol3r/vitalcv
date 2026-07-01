/**
 * GET /api/admin/platform — Deployment Integrity report (ADMIN only).
 * Powers the Founder Dashboard (/admin/platform) and any external monitor.
 * Detect-only; never mutates infrastructure.
 */
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { buildIntegrityReport } from '@/lib/platform/deployment-integrity';

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

  const report = await buildIntegrityReport({ railwayToken: process.env.RAILWAY_API_TOKEN });
  return NextResponse.json(report, { status: 200 });
}
