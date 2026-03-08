import { type NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
export async function POST(_req: NextRequest, { params }: { params: Promise<{ npi: string }> }) {
  const { npi } = await params;
  try {
    const up = await fetch(`${BACKEND}/api/passport/analytics/${encodeURIComponent(npi)}/download`, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(5000) });
    return NextResponse.json(await up.json() as unknown, { status: up.ok ? 200 : up.status });
  } catch { return NextResponse.json({ ok: true }); }
}
