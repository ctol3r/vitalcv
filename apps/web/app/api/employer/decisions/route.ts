/**
 * Wave 244 — Employer Decision Capsules: GET proxy
 * GET /api/employer/decisions
 * Returns recent Decision Capsules for the verifier's org.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET(req: NextRequest) {
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (k.startsWith('x-clerk-')) headers[k] = v;
  });
  try {
    const res = await fetch(`${B}/api/employer/decisions`, { headers });
    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = typeof payload?.error === 'string' ? payload.error : 'Failed to fetch decisions';
      return NextResponse.json({ error: errorMsg }, { status: res.status });
    }

    return NextResponse.json(payload ?? {}, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}
