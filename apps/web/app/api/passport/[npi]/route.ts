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
    // Backend exposes two passport routes with divergent shapes:
    //   /api/passport/:npi       — public/wallet/selective NPI-shape from
    //                              routes/passport.ts (loadPassportData)
    //   /api/passport/npi/:npi   — entity-shape from routes/passportEntity.ts
    //                              (buildPassportDataByNpi)
    // The proxy validator (`assertPassportData`) expects the entity-shape:
    // top-level `entityId`, `identity`, `authority`, `training`, `standing`,
    // `readiness`, `sources`, `sourceCoverage`, `lastCheckedAt`, `trustPosture`.
    // Calling the NPI-shape route returned a different payload and produced
    // the `502 invalid_upstream_payload` we saw against seeded NPIs.
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
