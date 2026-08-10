import { NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/api';
import { checkAuth, readAuthEnv, readAuthHeaders } from '../../source-health/_auth';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<NextResponse> {
  // Machine-authenticated: this proxies the backend's mission-ops source
  // inventory to the web origin, and nothing in the product mounts a consumer
  // — its callers are operators and monitoring. Reuses the source-health
  // probe's checkAuth (same reasoning as agent/tick). Both env secrets
  // unset ⇒ 500, not open.
  const auth = checkAuth(readAuthHeaders(request), readAuthEnv());
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    // The backend's /api/mission-ops/sources is operator-gated. This proxy sent
    // NO headers at all, so it has been getting 401 from the backend since
    // before it was machine-authenticated — the auth above protected a call
    // that never succeeded. Forward the operator secret server-side (same
    // pattern as app/api/pilot-roi-export) so the operator path actually works.
    const monitoringSecret = process.env.MONITORING_SECRET?.trim();
    if (!monitoringSecret) {
      return NextResponse.json(
        { error: 'MONITORING_SECRET not configured.' },
        { status: 500 },
      );
    }

    const response = await fetch(`${getBackendBase()}/api/mission-ops/sources`, {
      cache: 'no-store',
      headers: { 'x-monitoring-secret': monitoringSecret },
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;

    if (!response.ok) {
      const upstreamError = typeof payload?.error === 'string'
        ? payload.error
        : 'Source health unavailable.';
      return NextResponse.json(
        { error: upstreamError },
        { status: response.status },
      );
    }

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: 'Backend unreachable.' }, { status: 502 });
  }
}
