/**
 * Wave 243 — Trust State Engine: GET proxy
 * GET /api/trust-state/:npi
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ npi: string }> },
) {
  const { npi } = await params;
  try {
    const res = await fetch(`${B}/api/trust-state/${npi}`, {
      headers: {
        // Public wedge uses the demo pilot org context.
        // Required while backend tenant guard awaits Railway redeploy (commit 5d42b1c6 in main).
        'x-org-id': process.env.PUBLIC_WEDGE_ORG_ID ?? 'demo-pilot-org-alpha',
      },
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}
