import { type NextRequest, NextResponse } from 'next/server';
import {
  fetchBackendJson,
  logIntelligenceFallbackUsage,
  resolveIntelligenceAuthContext,
} from '../../intelligence/_shared';

export const runtime = 'nodejs';

function buildEmptyOutcomesPayload() {
  return {
    schema: 'https://vitalcv.com/outcome-history/v1',
    outcomes: [],
    total: 0,
    generatedAt: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const authContext = await resolveIntelligenceAuthContext();
  if (authContext.status !== 'authenticated') {
    return NextResponse.json(buildEmptyOutcomesPayload());
  }

  const params = new URLSearchParams();
  const limit = req.nextUrl.searchParams.get('limit');
  const investigatorId = req.nextUrl.searchParams.get('investigatorId');
  if (limit) params.set('limit', limit);
  if (investigatorId) params.set('investigatorId', investigatorId);

  try {
    const { ok, payload } = await fetchBackendJson<unknown>(
      '/api/findings/outcomes',
      params.toString() ? params : undefined,
      12_000,
      { context: authContext },
    );
    if (!ok) {
      logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
      return NextResponse.json(buildEmptyOutcomesPayload());
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    void error;
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
    return NextResponse.json(buildEmptyOutcomesPayload());
  }
}
