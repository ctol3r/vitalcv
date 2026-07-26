/**
 * Wave 245 — Async Trust Engine: POST proxy
 * POST /api/trust/events
 * POST /api/trust/events/batch (handled by Next.js via subpath)
 */
import { NextRequest, NextResponse } from 'next/server';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';

export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    // Identity is derived from the SERVER-side Clerk session (G1) — previously
    // this proxy forwarded the client-supplied x-clerk-user-id header verbatim,
    // which was spoofable by any caller.
    const res = await fetch(`${B}/api/trust/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await buildIdentityHeaders()),
      },
      body,
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}
