/**
 * /api/passport/analytics/[npi] — Wave 167: Passport Analytics (Next.js proxy)
 *
 * GET → per-NPI analytics
 */
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ npi: string }> },
) {
  try {
    const { npi } = await params;
    const upstream = await fetch(`${BACKEND}/api/passport/analytics/${encodeURIComponent(npi)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream ${upstream.status}` }, { status: upstream.status });
    }
    return NextResponse.json(await upstream.json() as unknown);
  } catch (err) {
    return NextResponse.json({ error: 'Analytics unavailable', detail: String(err) }, { status: 503 });
  }
}
