import { type NextRequest, NextResponse } from 'next/server';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import {
  logPassportRuntimeFailure,
  logPassportRuntimeSuccess,
} from '@/lib/trust/passport-observability';
import { invalidNpiResponse, isStructurallyValidNpi } from '@/lib/trust/npi-format';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ npi: string }> },
) {
  const { npi } = await params;

  // Structurally malformed input is not a passport read — reject before the
  // runtime degrades it into a passport-shaped 200. Well-formed-but-unknown
  // NPIs deliberately fall through to the degraded read below.
  if (!isStructurallyValidNpi(npi)) {
    return invalidNpiResponse();
  }

  const startedAt = performance.now();

  try {
    const passport = await resolvePassportRuntimePassport(npi);
    logPassportRuntimeSuccess({
      route: '/api/passport/[npi]',
      entityId: npi,
      passport,
      startedAt,
    });
    return NextResponse.json(passport, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logPassportRuntimeFailure({
      route: '/api/passport/[npi]',
      entityId: npi,
      error,
      startedAt,
    });
    return NextResponse.json(
      {
        error: 'passport_runtime_unavailable',
        detail: 'Passport runtime failed before a degraded response could be generated.',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
