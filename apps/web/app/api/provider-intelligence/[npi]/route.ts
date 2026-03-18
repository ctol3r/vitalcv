import { type NextRequest, NextResponse } from 'next/server';
import {
  authFailureStatus,
  buildAuthFailurePayload,
  canReadIntelligence,
  coerceRouteErrorPayload,
  fetchBackendJson,
  logIntelligenceFallbackUsage,
  resolveIntelligenceAuthContext,
} from '../../intelligence/_shared';

export const runtime = 'nodejs';
const NPI_RE = /^\d{10}$/;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ npi: string }> }) {
  const authContext = await resolveIntelligenceAuthContext();
  const { npi } = await params;

  if (!NPI_RE.test(npi)) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  if (!canReadIntelligence(authContext)) {
    logIntelligenceFallbackUsage(`/api/provider-intelligence/${npi}`, authContext, 'read_fallback');
    return NextResponse.json(buildAuthFailurePayload(authContext), {
      status: authFailureStatus(authContext),
    });
  }

  try {
    const upstream = await fetchBackendJson(
      `/api/provider-intelligence/${npi}`,
      undefined,
      20_000,
      { context: authContext },
    );

    if (!upstream.ok) {
      logIntelligenceFallbackUsage(`/api/provider-intelligence/${npi}`, authContext, 'backend_fallback');
      return NextResponse.json(
        coerceRouteErrorPayload(upstream.payload, {
          error: 'backend_request_failed',
          error_description: `Provider intelligence backend returned ${upstream.status}.`,
        }),
        { status: upstream.status >= 400 ? upstream.status : 502 },
      );
    }

    return NextResponse.json(upstream.payload, { status: 200 });
  } catch (error) {
    logIntelligenceFallbackUsage(`/api/provider-intelligence/${npi}`, authContext, 'backend_fallback');
    return NextResponse.json(
      {
        error: 'backend_request_failed',
        error_description: error instanceof Error ? error.message : 'Provider intelligence request failed.',
      },
      { status: 503 },
    );
  }
}
