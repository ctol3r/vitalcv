import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

const NPI_RE = /^\d{10}$/;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ npi: string }> },
) {
  const { npi } = await params;
  if (!NPI_RE.test(npi)) return NextResponse.json({ error: 'Invalid NPI' }, { status: 400 });
  try {
    const resp = await fetch(`${BACKEND}/api/report/${npi}`, { signal: AbortSignal.timeout(30000), cache: 'no-store' });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: 'Report unavailable', detail: String(err) }, { status: 503 });
  }
}
