import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backend-url';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.toString();
  const url = `${BACKEND_URL}/api/cases${query ? `?${query}` : ''}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    const body = await res.json();
    return NextResponse.json(body, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Cases unavailable' }, { status: 502 });
  }
}
