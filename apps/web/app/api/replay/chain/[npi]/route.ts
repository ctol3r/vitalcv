/**
 * GET /api/replay/chain/[npi]
 *
 * Public, no auth, no-store.
 * Returns the full reconstructed replay chain for a given NPI
 * from durable DB state via the backend reconstructor.
 *
 * Response shape mirrors ReplayChainReport from replayReconstructor.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiUrl } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ npi: string }> },
): Promise<NextResponse> {
  const { npi } = await params;

  if (!npi || !/^\d{10}$/.test(npi)) {
    return NextResponse.json({ error: 'Invalid NPI. Must be exactly 10 digits.' }, { status: 400 });
  }

  try {
    // Fetch all source runs for this NPI from backend, build chain client-side
    const backendUrl = apiUrl(`/api/replay/runs/by-npi/${encodeURIComponent(npi)}`);
    const res = await fetch(backendUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = await res.json() as unknown;
      return NextResponse.json(data, {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    if (res.status === 404) {
      return NextResponse.json(
        { npi, chain: [], totalRuns: 0, message: 'No runs found for this NPI' },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  } catch {
    // Backend unreachable — return empty chain with disclosure
  }

  return NextResponse.json(
    {
      npi,
      chain: [],
      totalRuns: 0,
      message: 'Backend unavailable — chain not retrievable',
      degraded: true,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
