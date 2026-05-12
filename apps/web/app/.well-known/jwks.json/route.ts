/**
 * GET /.well-known/jwks.json
 *
 * RFC 8615 + RFC 7517 well-known location for the issuer's public JWK Set.
 *
 * VitalCV historically published its JWKS under the namespaced path
 * `/api/.well-known/jwks.json`, which is functional but RFC-incorrect:
 * external verifiers expect the JWKS at the bare `/.well-known/jwks.json`
 * root. This handler is a thin re-export so the same key material is
 * reachable at both paths — the namespaced one is kept for backward
 * compatibility with any internal caller; the root path is the
 * RFC-compliant one for institutional verifiers.
 *
 * Both routes share `getPublicKeyJwk()` so kid + key never diverge.
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
        'Content-Type': 'application/jwk-set+json',
      },
    },
  );
}
