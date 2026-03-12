/**
 * Wave 239 — MATCHA Live Proxy
 * GET /api/matcha/opportunities/[npi]
 * Proxies to backend GET /api/matcha/opportunities/:npi
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ npi: string }> },
) {
  try {
    const { npi } = await context.params;
    const { searchParams } = req.nextUrl;
    const qs = searchParams.toString();
    const url = `${BACKEND}/api/matcha/opportunities/${npi}${qs ? '?' + qs : ''}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000), // NPPES can be slow
    });

    const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[matcha/opportunities proxy] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch match data', matches: [] },
      { status: 502 },
    );
  }
}
