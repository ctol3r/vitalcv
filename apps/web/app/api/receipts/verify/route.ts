import { NextRequest, NextResponse } from 'next/server';
import { verifyReceiptJWT } from '../../../../lib/trust/jwtVerifier';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.token || typeof body.token !== 'string') {
    return NextResponse.json({ verified: false, error: 'token is required' }, { status: 400 });
  }
  if (body.token.length > 8192) {
    return NextResponse.json({ verified: false, error: 'token exceeds maximum length' }, { status: 400 });
  }
  const result = await verifyReceiptJWT(body.token);
  return NextResponse.json(result, { status: result.verified ? 200 : 422 });
}
