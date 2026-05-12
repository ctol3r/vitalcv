/**
 * GET /.well-known/did.json
 *
 * W3C DID document for did:web:vitalcv.com.
 * Enables decentralized identifier resolution and verifiable credential trust.
 *
 * Spec: https://w3c.github.io/did-core/
 * did:web method: https://w3c-ccg.github.io/did-method-web/
 */

import { NextResponse } from 'next/server';
import { getPublicKeyJwk } from '@/lib/crypto/receiptIssuer';

export const runtime = 'nodejs';

export const revalidate = 3600;

export async function GET() {
  const publicKeyJwk = await getPublicKeyJwk();

  const didDocument = {
    '@context': 'https://www.w3.org/ns/did/v1',
    id: 'did:web:vitalcv.com',
    verificationMethod: [
      {
        id: 'did:web:vitalcv.com#vcv-signing-key-1',
        type: 'JsonWebKey2020',
        controller: 'did:web:vitalcv.com',
        publicKeyJwk,
      },
    ],
    authentication: ['did:web:vitalcv.com#vcv-signing-key-1'],
  };

  return NextResponse.json(didDocument, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
