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

// Force runtime evaluation. Prerendering this route at build time would
// invoke getPublicKeyJwk() under NODE_ENV=production without the prod
// signing env vars set, which (correctly) throws via the fail-closed
// guard in receiptIssuer.ts. Marking dynamic keeps the guard intact for
// runtime requests while not blocking the build pipeline.
export const dynamic = 'force-dynamic';

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
