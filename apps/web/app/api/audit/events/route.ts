/**
 * /api/audit/events — Wave 162: Telemetry API Layer (Next.js proxy)
 *
 * Server-side proxy to the Express backend /api/audit/events endpoint.
 * Returns recent audit log entries for operator dashboards.
 * Safe: structural metadata only, no credential payloads or PHI.
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
    const limit = searchParams.get('limit') ?? '50';
    const category = searchParams.get('category');
    const since = searchParams.get('since');

    const params = new URLSearchParams({ limit });
    if (category) params.set('category', category);
    if (since) params.set('since', since);

    const upstream = await fetch(
      `${BACKEND}/api/audit/events?${params.toString()}`,
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
      { error: 'Audit events unavailable', detail: String(err) },
      { status: 503 },
    );
  }
}
