/**
 * GET /api/replay/[receiptId]
 *
 * Machine-readable replay inspection endpoint.
 * Public, no auth required.
 * Cache-Control: no-store — replay data must never be cached.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getReplayInspection } from '@/lib/replay/getReplayInspection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_RECEIPT_PATTERN = /^(rcpt_[a-zA-Z0-9_-]{1,128}|rec-[a-zA-Z0-9_-]{1,128})$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  const { receiptId } = await params;

  if (!receiptId || typeof receiptId !== 'string') {
    return NextResponse.json(
      { error: 'receiptId is required' },
      { status: 400 },
    );
  }

  if (!VALID_RECEIPT_PATTERN.test(receiptId)) {
    return NextResponse.json(
      { error: 'Invalid receiptId format. Must start with rcpt_ or rec-.' },
      { status: 404 },
    );
  }

  const inspection = await getReplayInspection(receiptId);

  if (!inspection) {
    return NextResponse.json(
      { error: 'Inspection unavailable for this receipt ID' },
      { status: 404 },
    );
  }

  return NextResponse.json(inspection, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  });
}
