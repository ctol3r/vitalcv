/**
 * Wave 243 — Trust State Engine: GET history proxy
 * GET /api/trust-state/:npi/history
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ npi: string }> },
) {
  const { npi } = await params;
  const { searchParams } = req.nextUrl;
  const qs = searchParams.toString();

  try {
    const res = await fetch(`${B}/api/trust-state/${npi}/history${qs ? '?' + qs : ''}`);
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}
