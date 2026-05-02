/**
 * GET /.well-known/jwks.json
 *
 * Publishes the ES256 public key so any verifier can validate
 * signed issuer receipts without calling back to VitalCV.
 *
 * The private key is NEVER included here — only the public JWK.
 * Cache-Control allows CDN caching for 1 hour with a 24h stale window,
 * accommodating key rotation without breaking in-flight verifications.
 */

import { NextResponse } from 'next/server';
import { getPublicKeyJwk } from '@/lib/crypto/receiptIssuer';

export const runtime = 'nodejs';

export const revalidate = 3600;

export async function GET() {
  const publicKeyJwk = await getPublicKeyJwk();

  return NextResponse.json(
    { keys: [publicKeyJwk] },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    },
  );
}
