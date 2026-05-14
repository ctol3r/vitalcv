import { NextRequest, NextResponse } from 'next/server';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import {
  logPassportRuntimeFailure,
  logPassportRuntimeSuccess,
} from '@/lib/trust/passport-observability';

export const runtime = 'nodejs';

/**
 * Local passport hydration for entity ID (UUID) or NPI.
 * NPI inputs resolve against the direct NPPES probe path.
 * UUID inputs return truthful degraded passport structure without
 * depending on the legacy backend runtime.
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const startedAt = performance.now();

  try {
    const passport = await resolvePassportRuntimePassport(id);
    logPassportRuntimeSuccess({
      route: '/api/passport/entity/[id]',
      entityId: id,
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
      route: '/api/passport/entity/[id]',
      entityId: id,
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
