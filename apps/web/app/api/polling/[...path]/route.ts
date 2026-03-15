import { getApiBase } from '@/lib/api';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
const BACKEND = getApiBase();

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const qs = req.nextUrl.search;
  try {
    const res = await fetch(`${BACKEND}/api/polling/${path.join('/')}${qs}`);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch { return NextResponse.json({ error: 'proxy failed' }, { status: 502 }); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  try {
    const body = await req.text();
    const res = await fetch(`${BACKEND}/api/polling/${path.join('/')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body || '{}',
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch { return NextResponse.json({ error: 'proxy failed' }, { status: 502 }); }
}
