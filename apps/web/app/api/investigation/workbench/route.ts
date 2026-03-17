import { type NextRequest, NextResponse } from 'next/server';
import {
  attachAccessMetadata,
  coerceRouteErrorPayload,
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

  try {
    const upstream = await fetchBackendJson<Record<string, unknown>>(
      '/api/investigation/workbench',
      params,
      12_000,
      { context: authContext },
    );
    if (!upstream.ok) {
      logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
      return NextResponse.json(
        coerceRouteErrorPayload(upstream.payload, {
          error: 'backend_request_failed',
          error_description: `Workbench backend returned ${upstream.status}.`,
        }),
        { status: upstream.status >= 400 ? upstream.status : 502 },
      );
    }

    return NextResponse.json(
      attachAccessMetadata(upstream.payload, {
        accessMode: 'full',
        reason: 'ok',
      }),
      { status: 200 },
    );
  } catch (error) {
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
    return NextResponse.json(
      {
        error: 'backend_request_failed',
        error_description: error instanceof Error ? error.message : 'Workbench request failed.',
      },
      { status: 503 },
    );
  }
}
