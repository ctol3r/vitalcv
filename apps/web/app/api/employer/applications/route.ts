import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
const B = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export async function GET(req: NextRequest) {
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { if (k.startsWith('x-clerk-')) headers[k] = v; });
  const res = await fetch(`${B}/api/employer/applications`, { headers });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
