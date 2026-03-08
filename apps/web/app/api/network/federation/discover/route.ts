/**
 * /api/network/federation/discover — Wave 166: Federation Discovery (Next.js proxy)
 *
 * GET  → list discovered issuer candidates (no registration)
 * POST → discover + auto-register validated issuers
 */
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET() {
  try {
    const upstream = await fetch(`${BACKEND}/api/network/federation/discover`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream ${upstream.status}` }, { status: upstream.status });
    }
    return NextResponse.json(await upstream.json() as unknown);
  } catch (err) {
    return NextResponse.json({ error: 'Discovery unavailable', detail: String(err) }, { status: 503 });
  }
}

export async function POST(_req: NextRequest) {
  try {
    const body = await _req.text();
    const upstream = await fetch(`${BACKEND}/api/network/federation/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body || '{}',
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream ${upstream.status}` }, { status: upstream.status });
    }
    return NextResponse.json(await upstream.json() as unknown);
  } catch (err) {
    return NextResponse.json({ error: 'Auto-register failed', detail: String(err) }, { status: 503 });
  }
}
