import { getApiBase } from '@/lib/api';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
const BACKEND = getApiBase();

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const qs = req.nextUrl.search;
  try {
    const res = await fetch(`${BACKEND}/api/investigators/${path.join('/')}${qs}`);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch { return NextResponse.json({ error: 'proxy failed' }, { status: 502 }); }
}
