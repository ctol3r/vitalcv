/**
 * /api/network/health — Wave 163: Telemetry UI Wiring (Next.js proxy)
 *
 * Server-side proxy to the Express backend /api/network/health endpoint.
 * Returns overallStatus, node/issuer/payer health + stats.
 * Safe: aggregate counts only, no PHI.
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
    const upstream = await fetch(`${BACKEND}/api/network/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
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
      { error: 'Network health unavailable', detail: String(err) },
      { status: 503 },
    );
  }
}
