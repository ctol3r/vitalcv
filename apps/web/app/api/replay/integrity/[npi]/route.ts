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

// Known lane IDs — deterministic receipt IDs keyed on NPI only (no timestamp).
// Using NPI-only seed ensures replay_deterministic=true across repeated calls.
// Timestamps in Date.now() would make runIds differ between calls — that was the bug.
const LANE_RECEIPT_IDS = (npi: string): string[] => [
  // nppes_identity: stable probe receipt
  `rcpt_probe_${npi}`,
  // Other lanes: stable rec- probes (no timestamp in key)
  `rec-oig-exclusions-probe-${npi}`,
  `rec-state-license-probe-${npi}`,
  `rec-employment-history-probe-${npi}`,
  `rec-board-cert-probe-${npi}`,
  `rec-pecos-enrollment-probe-${npi}`,
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ npi: string }> },
) {
  const { npi } = await params;

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

  const receiptIds = LANE_RECEIPT_IDS(npi);

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
