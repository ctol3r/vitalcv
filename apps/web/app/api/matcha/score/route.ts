/**
 * Wave 239 — MATCHA Score Proxy
 * POST /api/matcha/score
 * Body: { npi, opportunityId }
 * Proxies to backend POST /api/matcha/explain
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
    const res = await fetch(`${BACKEND}/api/matcha/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[matcha/score proxy] error:', error);
    return NextResponse.json(
      { error: 'Failed to score opportunity' },
      { status: 502 },
    );
  }
}
