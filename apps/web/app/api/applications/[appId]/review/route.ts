import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
const B = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  req.headers.forEach((v, k) => { if (k.startsWith('x-clerk-')) headers[k] = v; });
  const body = await req.text();
  const res = await fetch(`${B}/api/applications/${appId}/review`, { method: 'PATCH', headers, body });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
