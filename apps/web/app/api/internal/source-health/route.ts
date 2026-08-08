import { NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/api';
import { checkAuth, readAuthEnv, readAuthHeaders } from './_auth';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<NextResponse> {
  // Byte-identical twin of /api/internal/mission-ops/sources — same upstream,
  // same exposure — so it takes the same machine auth its own probe/ and
  // snapshots/ subroutes already use.
  //
  // Its only in-repo consumers (components/pilot-ops/SourceHealthPanel,
  // PilotDiagnosticsPanel) are browser components that no page mounts. A
  // browser cannot hold a shared secret, so whoever mounts them must switch
  // this to requireAdminPilotSession() rather than reopen the route.
  const auth = checkAuth(readAuthHeaders(request), readAuthEnv());
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const response = await fetch(`${getBackendBase()}/api/mission-ops/sources`, {
      cache: 'no-store',
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
