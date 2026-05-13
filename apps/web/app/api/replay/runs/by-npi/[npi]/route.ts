/**
 * REPLAY-PERSIST-γ — Web App Router proxy for NPI-keyed run discovery.
 *
 * GET /api/replay/runs/by-npi/[npi]
 *   → 200 with { npi, entityId, runs[] } sorted newest-first
 *   → 400 when npi does not match `^\d{10}$`
 *   → 200 with entityId:null and empty runs[] when no entity exists yet
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
    const res = await fetch(`${B}/api/replay/runs/by-npi/${npi}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const payload = await res.json().catch(() => null);
    return NextResponse.json(payload ?? { error: 'invalid_upstream_payload' }, {
      status: res.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'replay_runs_by_npi_upstream_unavailable', detail: String(error) },
      { status: 503 },
    );
  }
}
