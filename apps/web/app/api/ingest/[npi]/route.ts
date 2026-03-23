import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
const B = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
export async function POST(_req: NextRequest, context: { params: Promise<{ npi: string }> }) {
  const { npi } = await context.params;
  const res = await fetch(`${B}/api/ingest/${npi}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
