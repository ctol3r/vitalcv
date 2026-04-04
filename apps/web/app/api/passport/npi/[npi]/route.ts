import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { BACKEND_URL as B } from '@/lib/backend-url';
export async function GET(_req: NextRequest, context: { params: Promise<{ npi: string }> }) {
  const { npi } = await context.params;
  const res = await fetch(`${B}/api/passport/npi/${npi}`);
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
