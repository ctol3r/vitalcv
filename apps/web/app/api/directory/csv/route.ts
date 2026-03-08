/**
 * /api/directory/csv — Wave 164: Provider Directory Export (Next.js proxy)
 *
 * Server-side proxy to the Express backend /api/directory/csv endpoint.
 * Returns a CSV file of verified providers for downstream systems.
 * Safe: provider metadata only, no PHI credentials.
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
      `${BACKEND}/api/directory/csv?${params.toString()}`,
      { cache: 'no-store', signal: AbortSignal.timeout(30_000) },
    );

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status },
      );
    }

    const text = await upstream.text();
    return new NextResponse(text, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="vitalcv-directory-${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'CSV directory export failed', detail: String(err) },
      { status: 503 },
    );
  }
}
