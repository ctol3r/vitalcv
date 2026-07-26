/**
 * Wave 239 — MATCHA Live Proxy
 * GET /api/matcha/opportunities/[npi]
 * Proxies to backend GET /api/matcha/opportunities/:npi
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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ npi: string }> },
) {
  try {
    const { npi } = await context.params;
    const { searchParams } = req.nextUrl;
    const qs = searchParams.toString();
    const url = `${BACKEND}/api/matcha/opportunities/${npi}${qs ? '?' + qs : ''}`;

    // Derive the clinician's CandidateIntent from their durable, Clerk-scoped
    // preferences and forward it to the matcher, so the live feed ranks on
    // preference + credentials rather than credentials alone. Preferences are
    // self-stated (never a credential/evidence claim), so deriving the intent
    // in this authenticated proxy is safe. A missing/failed lookup just falls
    // back to credential-only ranking — it must never break the feed.
    const headers: Record<string, string> = {};
    try {
      const { userId } = await auth();
      if (userId && /^\d{10}$/.test(npi)) {
        const row = await prisma.matchaPreference.findUnique({ where: { clerkUserId: userId } });
        if (row?.data) {
          const prefs = sanitizeStoredPreferences(row.data);
          headers['x-matcha-intent'] = JSON.stringify(toCandidateIntent(npi, prefs));
        }
      }
    } catch (prefErr) {
      console.error('[matcha/opportunities proxy] preference load failed:', prefErr);
    }

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15_000), // NPPES can be slow
    });

    const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[matcha/opportunities proxy] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch match data', matches: [] },
      { status: 502 },
    );
  }
}
