/**
 * /api/network/telemetry — Wave 162: Telemetry API Layer (Next.js proxy)
 *
 * Server-side proxy to the Express backend /api/network/telemetry endpoint.
 * Avoids CORS/firewall issues when the Express backend is not directly
 * accessible from the browser in production.
 *
 * Returns: { verificationRate, revocationRate, issuerActivity, decisionCapsuleRate }
 * Safe: no PHI, no secrets — aggregate telemetry only.
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
      `${BACKEND}/api/network/telemetry?days=${days}`,
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
      { error: 'Telemetry unavailable', detail: String(err) },
      { status: 503 },
    );
  }
}
