import { type NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { BACKEND_URL as BACKEND } from '@/lib/backend-url';
export async function POST(_req: NextRequest, { params }: { params: Promise<{ npi: string }> }) {
  const { npi } = await params;
  try {
    const up = await fetch(`${BACKEND}/api/passport/analytics/${encodeURIComponent(npi)}/download`, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(5000) });
    return NextResponse.json(await up.json() as unknown, { status: up.ok ? 200 : up.status });
  } catch { return NextResponse.json({ ok: true }); }
}
