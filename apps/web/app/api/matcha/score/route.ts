/**
 * Wave 239 — MATCHA Score Proxy
 * POST /api/matcha/score
 * Body: { npi, opportunityId }
 * Proxies to backend POST /api/matcha/explain
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { sanitizeStoredPreferences, toCandidateIntent } from '@/lib/matcha/preferences';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { npi?: string; opportunityId?: string };

    // Enrich with the signed-in clinician's CandidateIntent so the per-role
    // score reflects preference + credentials, consistent with the ranked list.
    // Preference lookup is best-effort — never blocks scoring.
    const npi = typeof body.npi === 'string' ? body.npi : '';
    let intent: unknown;
    try {
      const { userId } = await auth();
      if (userId && /^\d{10}$/.test(npi)) {
        const row = await prisma.matchaPreference.findUnique({ where: { clerkUserId: userId } });
        if (row?.data) intent = toCandidateIntent(npi, sanitizeStoredPreferences(row.data));
      }
    } catch (prefErr) {
      console.error('[matcha/score proxy] preference load failed:', prefErr);
    }

    const res = await fetch(`${BACKEND}/api/matcha/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(intent ? { ...body, intent } : body),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[matcha/score proxy] error:', error);
    return NextResponse.json(
      { error: 'Failed to score opportunity' },
      { status: 502 },
    );
  }
}
