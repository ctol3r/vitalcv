/**
 * /api/directory/snapshot — Wave 164: Provider Directory Export (Next.js proxy)
 *
 * GET  → proxy to /api/directory/snapshots (list all snapshots)
 * POST → proxy to /api/directory/publish (publish a new snapshot)
 *
 * Safe: snapshot metadata only (hash, count, timestamp), no PHI.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET() {
  try {
    const upstream = await fetch(`${BACKEND}/api/directory/snapshots`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status },
      );
    }

    const data = await upstream.json() as unknown;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: 'Snapshot list unavailable', detail: String(err) },
      { status: 503 },
    );
  }
}

export async function POST() {
  try {
    const upstream = await fetch(`${BACKEND}/api/directory/publish`, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status },
      );
    }

    const data = await upstream.json() as unknown;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: 'Snapshot publish failed', detail: String(err) },
      { status: 503 },
    );
  }
}
