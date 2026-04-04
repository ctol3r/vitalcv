import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
const B = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  // If id looks like an NPI (10 digits), use the NPI route; otherwise use entity UUID route
  const isNpi = /^\d{10}$/.test(id);
  const url = isNpi ? `${B}/api/passport/npi/${id}` : `${B}/api/passport/entity/${id}`;
  const res = await fetch(url);
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
