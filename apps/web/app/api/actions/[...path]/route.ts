import { getApiBase } from '@/lib/api';
import { loadActionDetail } from '@/lib/intelligence/server';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
const BACKEND = getApiBase();

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path.length === 1) {
    const detail = await loadActionDetail(path[0] ?? '');
    if (!detail) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    return NextResponse.json(detail);
  }

  const qs = req.nextUrl.search;
  try {
    const res = await fetch(`${BACKEND}/api/actions/${path.join('/')}${qs}`);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch { return NextResponse.json({ error: 'proxy failed' }, { status: 502 }); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND}/api/actions/${path.join('/')}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch { return NextResponse.json({ error: 'proxy failed' }, { status: 502 }); }
}
