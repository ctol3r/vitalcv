/**
 * GET /api/marketplace/pool — employer-facing credential-ready clinician pool.
 * Proxies to backend GET /api/marketplace/pool (Clerk-gated). Forwards the caller's
 * Clerk user id so the backend can authorize. Returns PHI-free pool entries only
 * (NPI, specialty, locations, trust band, readiness score, availability, passport URL).
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backend-url';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const qs = req.nextUrl.searchParams.toString();
  try {
    const res = await fetch(`${BACKEND_URL}/api/marketplace/pool${qs ? `?${qs}` : ''}`, {
      headers: { 'x-clerk-user-id': session.userId },
      signal: AbortSignal.timeout(16_000),
    });
    const data = await res.json().catch(() => ({ error: 'Invalid response from backend', pool: [] }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch candidate pool', pool: [] }, { status: 502 });
  }
}
