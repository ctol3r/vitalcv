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
  const { searchParams } = req.nextUrl;
  const params = new URLSearchParams();

  const npi = searchParams.get('npi');
  const findingId = searchParams.get('findingId');
  const storylineId = searchParams.get('storylineId');

  if (npi) params.set('npi', npi);
  if (findingId) params.set('findingId', findingId);
  if (storylineId) params.set('storylineId', storylineId);

  if (!npi && !findingId && !storylineId) {
    return NextResponse.json(
      { error: 'At least one anchor (npi, findingId, storylineId) is required' },
      { status: 400 },
    );
  }

  if (authContext.status !== 'authenticated') {
    return NextResponse.json(buildReadOnlyFallbackPayload('investigation-workbench', req, authContext));
  }

  try {
    const { ok, payload } = await fetchBackendJson<unknown>(
      '/api/investigation/workbench',
      params,
      12_000,
      { context: authContext },
    );
    if (!ok) {
      logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
      return NextResponse.json(buildReadOnlyFallbackPayload('investigation-workbench', req, authContext, { log: false }));
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    void error;
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
    return NextResponse.json(buildReadOnlyFallbackPayload('investigation-workbench', req, authContext, { log: false }));
  }
}
