import { NextResponse } from 'next/server';

import { buildOidc4vciMetadataPayload } from '@/apps/api/src/services/eudi/issuer';

export async function GET() {
  const payload = buildOidc4vciMetadataPayload();
  return NextResponse.json(payload);
}









