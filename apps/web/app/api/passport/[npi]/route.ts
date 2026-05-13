import { type NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backend-url';
import { assertPassportData } from '@/lib/trust/passport-contract';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ npi: string }> },
) {
  try {
    const { npi } = await params;
    // Backend has two passport routes with divergent shapes:
    //   /api/passport/:npi       — public/wallet/selective NPI-shape (different contract)
    //   /api/passport/npi/:npi   — entity-shape that this proxy's validator
    //                              (assertPassportData) expects.
    // The proxy targets the entity-shape route so PassportData validation
    // does not 502.
    const upstream = await fetch(`${BACKEND_URL}/api/passport/npi/${encodeURIComponent(npi)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const payload = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      const error = typeof (payload as { error?: unknown } | null)?.error === 'string'
        ? (payload as { error: string }).error
        : 'Passport unavailable';
      const detail = typeof (payload as { detail?: unknown } | null)?.detail === 'string'
        ? (payload as { detail: string }).detail
        : `Passport upstream returned ${upstream.status}.`;
      return NextResponse.json({ error, detail }, { status: upstream.status });
    }

    const passport = assertPassportData(payload);
    return NextResponse.json(passport, { status: upstream.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error && error.message.startsWith('Invalid passport payload')
          ? 'invalid_upstream_payload'
          : 'Passport unavailable',
        detail: String(error),
      },
      { status: error instanceof Error && error.message.startsWith('Invalid passport payload') ? 502 : 503 },
    );
  }
}
