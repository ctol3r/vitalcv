import { getApiBase } from '@/lib/api';
import { type NextRequest, NextResponse } from 'next/server';

const BACKEND = getApiBase();

export async function GET(req: NextRequest) {
  const url = `${BACKEND}/api/profile/completeness`;
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { if (k.startsWith('x-clerk-')) headers[k] = v; });
  const res = await fetch(url, { method: 'GET', headers });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
