import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backend-url';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/employer-actions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const payload = await res.json().catch(() => null);
    return NextResponse.json(payload ?? {}, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'employer_actions_unreachable',
        detail: error instanceof Error ? error.message : 'Unknown upstream error',
      },
      { status: 502 },
    );
  }
}
