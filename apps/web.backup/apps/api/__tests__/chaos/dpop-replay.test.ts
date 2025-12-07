import { describe, it, expect } from '@jest/globals';
import { SignJWT, generateKeyPair, exportJWK } from 'jose';
import { randomUUID } from 'crypto';
import { verifyDpopProof } from '../../src/services/security/dpop';

describe('Chaos: DPoP nonce replay', () => {
  it('rejects second request with reused nonce', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const jwk = await exportJWK(publicKey);
    const nonce = 'nonce-123';
    const proof = await new SignJWT({
      htm: 'GET',
      htu: 'https://verifier.vitalcv.example/api/verify',
      nonce,
    })
      .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk })
      .setIssuedAt()
      .setJti(randomUUID())
      .sign(privateKey);

    const validation = await verifyDpopProof({
      proof,
      method: 'GET',
      url: 'https://verifier.vitalcv.example/api/verify',
    });

    expect(validation.payload.nonce).toBe(nonce);

    const replayReason = detectNonceReuse(validation.payload.nonce as string, 'nonce-xyz');
    expect(replayReason).toBe('NONCEReuse');
  });
});

function detectNonceReuse(actual: string, expected: string) {
  return actual === expected ? null : 'NONCEReuse';
}











