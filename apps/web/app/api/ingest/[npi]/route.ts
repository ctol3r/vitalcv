import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { BACKEND_URL as B } from '@/lib/backend-url';
export async function POST(_req: NextRequest, context: { params: Promise<{ npi: string }> }) {
  const { npi } = await context.params;
  const res = await fetch(`${B}/api/ingest/${npi}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Public wedge org context — required while backend tenant guard awaits Railway redeploy.
      'x-org-id': process.env.PUBLIC_WEDGE_ORG_ID ?? 'demo-pilot-org-alpha',
    },
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
