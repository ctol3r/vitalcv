/**
 * GET /api/replay/integrity/[npi]
 *
 * Public, no auth, no-store.
 * Runs validateReplayChain on known runs for this NPI.
 * Returns: ReplayIntegrityReport
 */

import { NextRequest, NextResponse } from 'next/server';
import { getReplayInspection } from '@/lib/replay/getReplayInspection';
import {
  validateReplayChain,
  type ReplayChainEntry,
} from '@/lib/replay/replayIntegrity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Known lane IDs and their rec- prefix slugs
const LANE_RECEIPT_IDS = (npi: string, now: number): string[] => [
  // nppes_identity uses rcpt_ format (T4 issuer-signed path)
  `rcpt_v1_${npi}_${now}`,
  // All other lanes use rec- format with 13-digit epoch
  `rec-oig-exclusions-${now}-${npi}`,
  `rec-state-license-${now}-${npi}`,
  `rec-employment-history-${now}-${npi}`,
  `rec-board-cert-${now}-${npi}`,
  `rec-pecos-enrollment-${now}-${npi}`,
];

export async function GET(
  _req: NextRequest,
  { params }: { params: { npi: string } },
) {
  const { npi } = params;

  // Validate NPI format (10 digits)
  if (!/^\d{10}$/.test(npi)) {
    return NextResponse.json(
      { error: 'Invalid NPI. Must be exactly 10 digits.' },
      {
        status: 400,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }

  const now = Date.now();
  const receiptIds = LANE_RECEIPT_IDS(npi, now);

  // Fetch inspection data for each lane in parallel
  const inspections = await Promise.all(
    receiptIds.map((id) => getReplayInspection(id).catch(() => null)),
  );

  // Flatten all runs into ReplayChainEntry objects
  const entries: ReplayChainEntry[] = [];

  for (let i = 0; i < inspections.length; i++) {
    const inspection = inspections[i];
    if (!inspection) continue;

    for (const run of inspection.runs) {
      entries.push({
        runId: run.runId,
        checkedAt: run.checkedAt,
        laneId: run.laneId,
        priorRunId: run.priorRunId,
        signerKid: inspection.signingKeyId,
        actorId: null, // not surfaced in ReplayRunEntry
      });
    }
  }

  // Run chain validation
  const report = validateReplayChain(entries, npi);

  return NextResponse.json(report, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
