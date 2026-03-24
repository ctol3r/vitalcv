/**
 * GET /api/trust/posture/[npi]
 *
 * Next.js proxy to the backend GET /api/trust/score/:npi endpoint.
 * Returns TrustScoreV1 with lightweight posture summary fields added.
 * Used by TrustPostureCard in PassportWallet and ReviewClient.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

const NPI_RE = /^\d{10}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ npi: string }> },
) {
  const { npi } = await params;

  if (!NPI_RE.test(npi)) {
    return NextResponse.json({ error: 'Invalid NPI' }, { status: 400 });
  }

  try {
    const resp = await fetch(`${BACKEND}/api/trust/score/${npi}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });

    if (!resp.ok) {
      return NextResponse.json(
        { error: `Backend returned ${resp.status}` },
        { status: resp.status },
      );
    }

    const score = await resp.json() as Record<string, unknown>;
    return NextResponse.json(score, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Trust posture unavailable', detail: String(err) },
      { status: 503 },
    );
  }
}
