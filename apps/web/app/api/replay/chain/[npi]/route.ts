/**
 * GET /api/replay/chain/[npi]
 *
 * Public, no auth, no-store.
 * Proxies to backend /api/replay/chain/:npi for continuity summary.
 * Returns per-lineage continuity state — no SQL access required.
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
    const backendUrl = apiUrl(`/api/replay/chain/${encodeURIComponent(npi)}`);
    const res = await fetch(backendUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'x-org-id': 'vcv-system' },
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
        { npi, lineages: [], totalRuns: 0, message: 'No runs found for this NPI' },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  } catch {
    // Backend unreachable
  }

  return NextResponse.json(
    { npi, lineages: [], totalRuns: 0, degraded: true, message: 'Backend unavailable' },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
