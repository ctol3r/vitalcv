import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
const B = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { if (k.startsWith('x-clerk-')) headers[k] = v; });
  const res = await fetch(`${B}/api/opportunities/${id}/applications`, { headers });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
