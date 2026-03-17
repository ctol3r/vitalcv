import { loadStorylineDetail } from '@/lib/intelligence/server';
import { type NextRequest, NextResponse } from 'next/server';
import {
  buildForwardHeaders,
  decorateAuthFailurePayload,
  requireAuthenticatedOrgContext,
  resolveIntelligenceAuthContext,
} from '../../intelligence/_shared';
import { getApiBase } from '@/lib/api';

export const runtime = 'nodejs';
const BACKEND = getApiBase();

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const authContext = await resolveIntelligenceAuthContext();
  const blocked = requireAuthenticatedOrgContext(req, authContext);
  if (blocked) {
    return NextResponse.json(blocked.payload, { status: blocked.status });
  }

  if (path.length === 1) {
    try {
      const detail = await loadStorylineDetail(path[0] ?? '');
      if (!detail) {
        return NextResponse.json({ error: 'Storyline not found' }, { status: 404 });
      }

      return NextResponse.json(detail);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Failed to load storyline detail',
          detail: error instanceof Error ? error.message : String(error),
        },
        { status: 503 },
      );
    }
  }

  const qs = req.nextUrl.search;
  try {
    const res = await fetch(`${BACKEND}/api/storylines/${path.join('/')}${qs}`, {
      headers: await buildForwardHeaders(undefined, { context: authContext }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    const payload = decorateAuthFailurePayload(await res.json().catch(() => ({})), res.status);
    return NextResponse.json(payload, { status: res.status });
  } catch { return NextResponse.json({ error: 'proxy failed' }, { status: 502 }); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const authContext = await resolveIntelligenceAuthContext();
  const blocked = requireAuthenticatedOrgContext(req, authContext);
  if (blocked) {
    return NextResponse.json(blocked.payload, { status: blocked.status });
  }

  try {
    const body = await req.text();
    const headers = await buildForwardHeaders({
      'Content-Type': req.headers.get('content-type') ?? 'application/json',
    }, { context: authContext });
    const res = await fetch(`${BACKEND}/api/storylines/${path.join('/')}`, {
      method: 'POST',
      headers,
      body: body || '{}',
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    const payload = decorateAuthFailurePayload(await res.json().catch(() => ({})), res.status);
    return NextResponse.json(payload, { status: res.status });
  } catch { return NextResponse.json({ error: 'proxy failed' }, { status: 502 }); }
}
