/**
 * Wave 245 — Async Trust Engine: POST proxy
 * POST /api/trust/events
 * POST /api/trust/events/batch (handled by Next.js via subpath)
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const clerkUserId = req.headers.get('x-clerk-user-id') ?? '';
    const res = await fetch(`${B}/api/trust/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-clerk-user-id': clerkUserId,
      },
      body,
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}
