/**
 * MATCHA Opportunity Simulator — web proxy.
 * GET /api/matcha/simulate/[npi]
 * Proxies to backend GET /api/matcha/simulate/:npi (deterministic "what if"
 * credential-impact analysis, re-scored from the clinician's real roles).
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

const NPI_RE = /^\d{10}$/;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ npi: string }> },
) {
  try {
    const { npi } = await context.params;
    if (!NPI_RE.test(npi)) {
      return NextResponse.json({ error: 'Invalid NPI — expected 10 digits' }, { status: 400 });
    }

    /*

     * C2 — simulation enumerates which credentials block this clinician: private state with no public-safe form. The web tier

     * refuses without a session so the preview cannot leak against a

     * backend that predates the guard; the backend refuses again and also

     * checks the NPI binding, which only it can do.

     */

    if (!_req.headers.get('authorization')) {

      return NextResponse.json(

        { error: 'Sign in to see readiness detail for your own NPI.' },

        { status: 401 },

      );

    }


    const res = await fetch(`${BACKEND}/api/matcha/simulate/${npi}`, {
      signal: AbortSignal.timeout(15_000),
    });

    const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[matcha/simulate proxy] error:', error);
    return NextResponse.json(
      { error: 'Failed to simulate impact', scenarios: [] },
      { status: 502 },
    );
  }
}
