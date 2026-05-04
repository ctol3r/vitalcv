import { type NextRequest, NextResponse } from 'next/server';
import { verifyReceiptSignature } from '@/lib/crypto/receiptVerifier';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  let jwt: string;

  try {
    const body = await req.json();
    jwt = typeof body?.jwt === 'string' ? body.jwt : '';
  } catch {
    return NextResponse.json(
      { verified: false, payload: null, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!jwt) {
    return NextResponse.json(
      { verified: false, payload: null, error: 'Missing jwt field in request body' },
      { status: 400 },
    );
  }

  const result = await verifyReceiptSignature(jwt);

  return NextResponse.json(result, { status: result.verified ? 200 : 401 });
}
