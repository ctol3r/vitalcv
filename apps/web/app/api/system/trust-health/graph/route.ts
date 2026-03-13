/**
 * /api/system/trust-health/graph — Wave 249: Trust Spine Hardening (Next.js proxy)
 *
 * Server-side proxy to the Express backend GET /api/system/trust-health/graph endpoint.
 * Returns the GraphIntegrityReport with orphaned nodes, invalid edges, and missing capsule edges.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET() {
  try {
    const upstream = await fetch(`${BACKEND}/api/system/trust-health/graph`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status },
      );
    }

    const data = await upstream.json() as unknown;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to reach trust health graph backend', detail: String(err) },
      { status: 503 },
    );
  }
}
