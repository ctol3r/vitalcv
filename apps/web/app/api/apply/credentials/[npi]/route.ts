/**
 * Proxy for the Apply flow's credential list (Wave 1072C / C1).
 *
 * Forwards the Authorization bearer so the backend can VERIFY the session —
 * the backend refuses without it, and refuses again unless NpiOwnership binds
 * the caller to this NPI. Identity headers are not forwarded: the whole point
 * is that the browser cannot assert who it is.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ npi: string }> },
) {
  const { npi } = await params;
  if (!/^\d{10}$/.test(npi)) {
    return NextResponse.json({ error: 'npi must be a 10-digit NPI.' }, { status: 400 });
  }

  const authorization = req.headers.get('authorization');
  if (!authorization) {
    return NextResponse.json(
      { error: 'Sign in to see and choose what you share.' },
      { status: 401 },
    );
  }

  try {
    const upstream = await fetch(`${BACKEND}/api/apply/credentials/${npi}`, {
      headers: { authorization },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'Credential service unavailable.' }, { status: 503 });
  }
}
