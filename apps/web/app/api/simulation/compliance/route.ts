/**
 * /api/simulation/compliance — Wave 248: Proxy to backend simulation
 * POST { rule, specialty?, state? } → ComplianceSimulationResult
 */
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

import { BACKEND_URL as B } from '@/lib/backend-url';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${B}/api/simulation/compliance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({ error: 'Invalid response' }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
