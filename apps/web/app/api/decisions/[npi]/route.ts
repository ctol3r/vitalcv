/**
 * Wave 244 — Decision Capsules: GET proxy
 * GET /api/decisions/:npi
 * Returns decision capsules for a clinician with trust_state_snapshot.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ npi: string }> },
) {
  const { npi } = await params;
  try {
    const res = await fetch(`${B}/api/decisions/${npi}`);
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}
