import { NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/api';
import { checkAuth, readAuthEnv, readAuthHeaders } from './_auth';

export const runtime = 'nodejs';

// Machine-authenticated like probe/ and snapshots/ below it: the backend's
// /api/mission-ops/sources sits behind a caller-supplied org header (gap G1),
// so this proxy is the surface that actually keeps the report internal.
export async function GET(request: Request): Promise<NextResponse> {
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
