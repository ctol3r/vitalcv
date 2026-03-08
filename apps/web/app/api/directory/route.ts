/**
 * /api/directory — Wave 164: Provider Directory Export (Next.js proxy)
 *
 * Server-side proxy to the Express backend /api/directory endpoint.
 * Returns the structured provider directory with credential health stats.
 * Safe: aggregate provider metadata only, no PHI credentials.
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
    const params = new URLSearchParams();
    for (const [k, v] of searchParams.entries()) params.set(k, v);

    const upstream = await fetch(
      `${BACKEND}/api/directory?${params.toString()}`,
      { cache: 'no-store', signal: AbortSignal.timeout(15_000) },
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
      { error: 'Directory unavailable', detail: String(err) },
      { status: 503 },
    );
  }
}
