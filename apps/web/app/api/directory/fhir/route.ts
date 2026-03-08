/**
 * /api/directory/fhir — Wave 164: Provider Directory Export (Next.js proxy)
 *
 * Server-side proxy to the Express backend /api/directory/fhir endpoint.
 * Streams a FHIR R4 Bundle of PractitionerRole resources.
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
      `${BACKEND}/api/directory/fhir?${params.toString()}`,
      { cache: 'no-store', signal: AbortSignal.timeout(30_000) },
    );

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status },
      );
    }

    const data = await upstream.json() as unknown;
    return NextResponse.json(data, {
      headers: {
        'Content-Type': 'application/fhir+json',
        'Content-Disposition': `attachment; filename="vitalcv-directory-${Date.now()}.json"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'FHIR directory export failed', detail: String(err) },
      { status: 503 },
    );
  }
}
