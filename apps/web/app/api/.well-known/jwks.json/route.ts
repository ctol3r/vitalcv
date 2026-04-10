import { NextResponse } from 'next/server';
import { getPublicJWKS } from '../../../../../api/backend/src/services/trust/cryptoService';

export async function GET() {
  return NextResponse.json(getPublicJWKS());
}
