import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

/**
 * GET /api/passport/[npi]/export
 *
 * Wave 3: Clinician-facing structured packet export proxy.
 * Proxies to the backend GET /api/passport/:npi/export route which returns
 * the full EmployerEvidencePacketV1 with all Wave 3 fields.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ npi: string }> },
) {
  const { npi } = await params;

  try {
    const upstream = await fetch(
      `${BACKEND}/api/passport/${encodeURIComponent(npi)}/export`,
      { cache: 'no-store', signal: AbortSignal.timeout(10_000) },
    );

    const body = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return NextResponse.json(body as Record<string, unknown>, { status: upstream.status });
    }

    return NextResponse.json(body as Record<string, unknown>, {
      status: 200,
      headers: {
        'Content-Disposition': upstream.headers.get('Content-Disposition') ?? '',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'export_failed', error_description: 'Passport export is temporarily unavailable.' },
      { status: 502 },
    );
  }
}
