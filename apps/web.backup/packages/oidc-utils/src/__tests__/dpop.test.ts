import { beforeAll, describe, expect, it } from 'vitest';
import { exportJWK, generateKeyPair } from 'jose';
import { buildDPoPProof, validateDPoPProof } from '../dpop';

describe('DPoP utilities', () => {
  let privateJwk: any;

  beforeAll(async () => {
    const { privateKey } = await generateKeyPair('EdDSA');
    privateJwk = await exportJWK(privateKey);
  });

  it('builds and validates a DPoP proof', async () => {
    const uri = 'https://api.vitalcv.com/resource?id=123#fragment';
    const { proof, thumbprint } = await buildDPoPProof({
      method: 'get',
      uri,
      signingKey: { jwk: privateJwk },
      nonce: 'server-nonce',
    });

    expect(proof).toBeTruthy();
    expect(thumbprint).toMatch(/^[A-Za-z0-9_-]+$/);

    const validation = await validateDPoPProof({
      proof,
      method: 'GET',
      uri,
    });

    expect(validation.valid).toBe(true);
    expect(validation.jkt).toBeTruthy();
  });

  it('rejects proof when method mismatches', async () => {
    const uri = 'https://api.vitalcv.com/secure';
    const { proof } = await buildDPoPProof({
      method: 'POST',
      uri,
      signingKey: { jwk: privateJwk },
    });

    const validation = await validateDPoPProof({
      proof,
      method: 'GET',
      uri,
    });

    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('HTTP method mismatch');
  });
});

