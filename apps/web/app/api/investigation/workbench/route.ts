import { type NextRequest, NextResponse } from 'next/server';
import {
  attachAccessMetadata,
  buildReadOnlyFallbackPayload,
  canReadIntelligence,
  fetchBackendJson,
  fetchPublicSnapshotJson,
  logIntelligenceFallbackUsage,
  resolveAccessReason,
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

  if (!npi && !findingId && !storylineId && canReadIntelligence(authContext)) {
    return NextResponse.json(
      { error: 'At least one anchor (npi, findingId, storylineId) is required' },
      { status: 400 },
    );
  }

  try {
    const { ok, payload } = canReadIntelligence(authContext)
      ? await fetchBackendJson<Record<string, unknown>>(
        '/api/investigation/workbench',
        params,
        12_000,
        { context: authContext },
      )
      : await fetchPublicSnapshotJson<Record<string, unknown>>(
        'investigation-workbench',
        params,
        authContext,
        12_000,
      );
    if (!ok) {
      logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
      return NextResponse.json(attachAccessMetadata(
        buildReadOnlyFallbackPayload('investigation-workbench', req, authContext, { log: false }),
        {
          accessMode: canReadIntelligence(authContext) ? 'full' : 'public_snapshot',
          reason: 'backend_unavailable',
        },
      ));
    }

    return NextResponse.json(attachAccessMetadata(payload, {
      accessMode: canReadIntelligence(authContext) ? 'full' : 'public_snapshot',
      reason: resolveAccessReason(
        authContext,
        canReadIntelligence(authContext) ? 'full' : 'public_snapshot',
        payload,
      ),
    }), { status: 200 });
  } catch (error) {
    void error;
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
    return NextResponse.json(attachAccessMetadata(
      buildReadOnlyFallbackPayload('investigation-workbench', req, authContext, { log: false }),
      {
        accessMode: canReadIntelligence(authContext) ? 'full' : 'public_snapshot',
        reason: 'backend_unavailable',
      },
    ));
  }
}
