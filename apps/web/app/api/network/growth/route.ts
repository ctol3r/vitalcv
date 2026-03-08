/**
 * /api/network/growth — Wave 162: Telemetry API Layer (Next.js proxy)
 *
 * Server-side proxy to the Express backend /api/network/growth endpoint.
 * Returns cumulative provider/issuer/credential growth over a time window.
 * Safe: counts only, no PHI.
 */
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const days = searchParams.get('days') ?? '30';

    const upstream = await fetch(
      `${BACKEND}/api/network/growth?days=${days}`,
      { cache: 'no-store', signal: AbortSignal.timeout(8000) },
    );

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
      { error: 'Growth data unavailable', detail: String(err) },
      { status: 503 },
    );
  }
}
