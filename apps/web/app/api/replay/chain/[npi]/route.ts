/**
 * REPLAY-PERSIST-γ — Web App Router proxy for NPI-keyed chain summary.
 *
 * GET /api/replay/chain/[npi]
 *   → 200 with { npi, entityId, lineages[] } where each lineage carries
 *     historyCount, latestRunId, latestCheckedAt, continuityState
 *     (stable | extended | diverged)
 *   → 400 when npi does not match `^\d{10}$`
 *   → 200 with entityId:null and empty lineages[] when no entity exists
 *   → 503 with stable error `replay_infrastructure_unavailable` when
 *     replay tables absent
 */
import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL as B } from '@/lib/backend-url';

export const runtime = 'nodejs';

const NPI_RE = /^\d{10}$/;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ npi: string }> },
) {
  const { npi } = await context.params;

  if (!NPI_RE.test(npi)) {
    return NextResponse.json(
      { error: 'invalid_npi', expected: '10 digits' },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${B}/api/replay/chain/${npi}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const payload = await res.json().catch(() => null);
    return NextResponse.json(payload ?? { error: 'invalid_upstream_payload' }, {
      status: res.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'replay_chain_upstream_unavailable', detail: String(error) },
      { status: 503 },
    );
  }
}
