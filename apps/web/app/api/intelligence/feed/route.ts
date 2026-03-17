import { getApiBase } from '@/lib/api';
import { type NextRequest, NextResponse } from 'next/server';
import {
  buildForwardHeaders,
  buildReadOnlyFallbackPayload,
  decorateAuthFailurePayload,
  logIntelligenceFallbackUsage,
  resolveIntelligenceAuthContext,
} from '../_shared';

export const runtime = 'nodejs';

const BACKEND = getApiBase();

export async function GET(req: NextRequest) {
  const authContext = await resolveIntelligenceAuthContext();
  if (authContext.status !== 'authenticated') {
    return NextResponse.json(buildReadOnlyFallbackPayload('feed', req, authContext));
  }

  try {
    const res = await fetch(`${BACKEND}/api/intelligence/feed${req.nextUrl.search}`, {
      headers: await buildForwardHeaders(undefined, { context: authContext }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
      return NextResponse.json(buildReadOnlyFallbackPayload('feed', req, authContext, { log: false }));
    }
    const payload = decorateAuthFailurePayload(await res.json().catch(() => ({})), res.status);
    return NextResponse.json(payload, { status: res.status });
  } catch {
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
    return NextResponse.json(buildReadOnlyFallbackPayload('feed', req, authContext, { log: false }));
  }
}
