import { getApiBase } from '@/lib/api';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND = getApiBase();

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(`${BACKEND}/api/intelligence/feed${req.nextUrl.search}`, {
      signal: AbortSignal.timeout(8000),
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 502 });
  }
}
