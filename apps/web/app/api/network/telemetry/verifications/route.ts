export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

import { BACKEND_URL as BACKEND } from '@/lib/backend-url';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const qs = searchParams.toString();
    const res = await fetch(`${BACKEND}/api/network/telemetry/verifications${qs ? `?${qs}` : ''}`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'upstream_error' }, { status: 502 });
  }
}
