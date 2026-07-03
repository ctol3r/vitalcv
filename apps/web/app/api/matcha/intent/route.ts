/**
 * MATCHA Intent Proxy
 * POST /api/matcha/intent
 * Body: CandidateIntent (npi + engine-relevant preference subset)
 * Proxies to backend POST /api/matcha/intent so stated preferences reach the match engine.
 *
 * Best-effort by design: the clinician's durable preference store is client-side localStorage.
 * A failed push here never loses an answer.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!body || typeof body !== 'object' || typeof (body as { npi?: unknown }).npi !== 'string') {
      return NextResponse.json({ error: 'npi is required' }, { status: 400 });
    }

    const res = await fetch(`${BACKEND}/api/matcha/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await res.json().catch(() => ({ ok: res.ok }));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[matcha/intent proxy] error:', error);
    return NextResponse.json({ error: 'Failed to save intent' }, { status: 502 });
  }
}
