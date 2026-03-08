import { getApiBase } from '@/lib/api';
import { type NextRequest, NextResponse } from 'next/server';
const BACKEND = getApiBase();
export async function POST(req: NextRequest) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  req.headers.forEach((v, k) => { if (k.startsWith('x-clerk-')) headers[k] = v; });
  const body = await req.text();
  const res = await fetch(`${BACKEND}/api/search/query`, { method: 'POST', headers, body });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
