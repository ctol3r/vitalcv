/**
 * /api/network/activity — Wave 162: Telemetry API Layer (Next.js proxy)
 *
 * Server-side proxy to the Express backend /api/network/activity endpoint.
 * Returns the live network activity feed (credential events, issuer registrations, etc.).
 * Safe: descriptions only, no PHI.
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
    const limit = searchParams.get('limit') ?? '25';

    const upstream = await fetch(
      `${BACKEND}/api/network/activity?limit=${limit}`,
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
      { error: 'Activity feed unavailable', detail: String(err) },
      { status: 503 },
    );
  }
}
