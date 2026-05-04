/**
 * POST /api/receipt/verify
 *
 * Zero-trust receipt verification endpoint.
 * Accepts an array of signed receipt JWTs and returns per-token verdicts.
 * The signing secret lives server-side only (RECEIPT_JWT_SECRET env var).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyReceiptJwts, resolveReceiptPosture } from '@/lib/receipt-verification';

export const runtime = 'nodejs';

interface VerifyRequestBody {
  tokens: string[];
}

export async function POST(req: NextRequest) {
  let body: VerifyRequestBody;

  try {
    body = (await req.json()) as VerifyRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body?.tokens) || body.tokens.length === 0) {
    return NextResponse.json({ error: 'tokens must be a non-empty array' }, { status: 400 });
  }

  if (body.tokens.length > 50) {
    return NextResponse.json({ error: 'Too many tokens (max 50)' }, { status: 400 });
  }

  if (body.tokens.some((t) => typeof t !== 'string')) {
    return NextResponse.json({ error: 'All tokens must be strings' }, { status: 400 });
  }

  const results = await verifyReceiptJwts(body.tokens);
  const posture = resolveReceiptPosture(results);

  return NextResponse.json({ posture, results });
}
