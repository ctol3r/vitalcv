/**
 * POST /api/report — Next.js proxy to backend POST /api/report
 * Generates a Credential Intelligence Report for a given NPI.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const resp = await fetch(`${BACKEND}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: 'Report unavailable', detail: String(err) }, { status: 503 });
  }
}
