/**
 * /api/webauthn/verify-assertion — proxy to Express backend
 * POST → backend POST /api/webauthn/verify-assertion
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const res = await fetch(`${B}/api/webauthn/verify-assertion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
