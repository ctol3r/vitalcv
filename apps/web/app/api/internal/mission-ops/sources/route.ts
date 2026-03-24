import { NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/api';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
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
