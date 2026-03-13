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
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}
