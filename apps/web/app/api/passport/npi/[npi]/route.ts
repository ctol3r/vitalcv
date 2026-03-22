import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
const B = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
export async function GET(_req: NextRequest, context: { params: Promise<{ npi: string }> }) {
  const { npi } = await context.params;
  const res = await fetch(`${B}/api/passport/npi/${npi}`);
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
