import { getApiBase } from '@/lib/api';
import { NextResponse } from 'next/server';
import { buildForwardHeaders, decorateAuthFailurePayload } from '../intelligence/_shared';

export const runtime = 'nodejs';
const BACKEND = getApiBase();

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/system-health`, {
      headers: await buildForwardHeaders(),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    const payload = decorateAuthFailurePayload(await res.json().catch(() => ({})), res.status);
    return NextResponse.json(payload, { status: res.status });
  } catch { return NextResponse.json({ error: 'proxy failed' }, { status: 502 }); }
}
