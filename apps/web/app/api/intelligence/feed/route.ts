import { type NextRequest, NextResponse } from 'next/server';
import {
  coerceRouteErrorPayload,
  fetchBackendJson,
  logIntelligenceFallbackUsage,
  resolveIntelligenceAuthContext,
} from '../_shared';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authContext = await resolveIntelligenceAuthContext();

  try {
    const upstream = await fetchBackendJson<Record<string, unknown>>(
      '/api/intelligence/feed',
      req.nextUrl.searchParams,
      8_000,
      { context: authContext },
    );

    if (!upstream.ok) {
      logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
      return NextResponse.json(
        coerceRouteErrorPayload(upstream.payload, {
          error: 'backend_request_failed',
          error_description: `Intelligence feed backend returned ${upstream.status}.`,
        }),
        { status: upstream.status >= 400 ? upstream.status : 502 },
      );
    }

    return NextResponse.json(upstream.payload, { status: upstream.status });
  } catch (error) {
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
    return NextResponse.json(
      {
        error: 'backend_request_failed',
        error_description: error instanceof Error ? error.message : 'Intelligence feed request failed.',
      },
      { status: 503 },
    );
  }
}
