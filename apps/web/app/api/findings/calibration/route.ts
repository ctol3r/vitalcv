import { type NextRequest, NextResponse } from 'next/server';
import {
  buildReadOnlyFallbackPayload,
  fetchBackendJson,
  logIntelligenceFallbackUsage,
  resolveIntelligenceAuthContext,
} from '../../intelligence/_shared';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authContext = await resolveIntelligenceAuthContext();
  if (authContext.status !== 'authenticated') {
    return NextResponse.json(buildReadOnlyFallbackPayload('calibration', req, authContext));
  }

  try {
    const { ok, payload } = await fetchBackendJson<unknown>('/api/findings/calibration', undefined, 12_000, {
      context: authContext,
    });
    if (!ok) {
      logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
      return NextResponse.json(buildReadOnlyFallbackPayload('calibration', req, authContext, { log: false }));
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    void error;
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
    return NextResponse.json(buildReadOnlyFallbackPayload('calibration', req, authContext, { log: false }));
  }
}
