import { getBackendBase } from '@/lib/api';
import { type NextRequest, NextResponse } from 'next/server';
import {
  buildForwardHeaders,
  decorateAuthFailurePayload,
  requireAuthenticatedOrgContext,
  resolveIntelligenceAuthContext,
} from '../../intelligence/_shared';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  // READ access: investigators are intelligence-surface data, org not required.
  // userId forwarded if present; anonymous reads are also allowed.
  const authContext = await resolveIntelligenceAuthContext();
  const qs = req.nextUrl.search;
  try {
    const res = await fetch(`${getBackendBase()}/api/investigators/${path.join('/')}${qs}`, {
      headers: await buildForwardHeaders(undefined, { context: authContext }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    const payload = decorateAuthFailurePayload(await res.json().catch(() => ({})), res.status);
    return NextResponse.json(payload, { status: res.status });
  } catch { return NextResponse.json({ error: 'proxy failed' }, { status: 502 }); }
}
