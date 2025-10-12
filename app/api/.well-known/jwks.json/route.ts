/**
 * JSON Web Key Set (JWKS) Endpoint
 *
 * GET /.well-known/jwks.json
 * Returns the issuer's public keys in JWK Set format
 * Used by verifiers to validate JWT signatures
 */

import { NextResponse } from 'next/server'
import { getIssuerKeyPair, exportPublicKeyJWK } from '@/lib/crypto/keys'

export async function GET() {
  try {
    const keyPair = getIssuerKeyPair()
    const jwk = exportPublicKeyJWK(keyPair)

    const jwks = {
      keys: [jwk],
    }

    return NextResponse.json(jwks, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('[JWKS] Error generating key set:', error)
    return NextResponse.json(
      { error: 'Failed to generate key set' },
      { status: 500 }
    )
  }
}
