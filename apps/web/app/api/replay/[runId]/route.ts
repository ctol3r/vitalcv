/**
 * GET /api/replay/[runId]
 *
 * Machine-readable replay inspection endpoint.
 * Accepts a runId or receiptId — passes through to getReplayInspection.
 * Public, no auth required.
 * Cache-Control: no-store — replay data must never be cached.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getReplayInspection } from '@/lib/replay/getReplayInspection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  if (!runId || typeof runId !== 'string' || runId.trim().length === 0) {
    return NextResponse.json(
      { error: 'runId is required' },
      { status: 400 },
    );
  }

  const inspection = await getReplayInspection(runId);

  if (!inspection) {
    return NextResponse.json(
      { error: 'Inspection unavailable for this run ID' },
      { status: 404 },
    );
  }

  // Map ReplayInspection to the canonical response shape.
  const latestRun = inspection.runs[0] ?? null;

  const body = {
    lineageKey: inspection.lineageKey,
    runId: inspection.runId,
    checkedAt: inspection.checkedAt,
    ownership: inspection.degradationOwnership === 'anonymous_preview' ? null : 'vcv-system',
    tier: latestRun?.tier ?? 'T1',
    receipt_continuity: {
      receiptId: inspection.receiptId,
      signingKeyId: inspection.signingKeyId,
      issuerDid: inspection.issuerDid,
      jwksUri: inspection.jwksUri,
    },
    runs: inspection.runs,
    gaps: inspection.gaps,
    survivabilityScore: inspection.survivabilityScore,
    survivabilityRationale: inspection.survivabilityRationale,
    degradationOwnership: inspection.degradationOwnership,
    sourceContinuity: inspection.sourceContinuity,
  };

  return NextResponse.json(body, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
