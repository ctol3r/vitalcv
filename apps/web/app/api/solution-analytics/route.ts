import { NextRequest, NextResponse } from 'next/server';
import { isSolutionEvent } from '@/lib/solutions/analytics';

export const runtime = 'nodejs';

/**
 * POST /api/solution-analytics — solutions funnel ingestion (Wave 700, C5).
 *
 * Accepts a typed, validated SolutionEvent (no PII). This endpoint is the
 * ingestion boundary; forwarding to a downstream analytics provider/warehouse is
 * an external integration (not persisted here). Fails closed on a malformed event.
 */
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (!isSolutionEvent(payload)) {
    return NextResponse.json({ error: 'invalid_event' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  // Accepted. A provider integration would forward `payload` here; we keep no PII and no record.
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
