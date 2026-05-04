/**
 * Tests for the zero-trust cryptographic receipt verifier.
 *
 * Strategy: sign real ES256 JWTs with a freshly generated key pair so we
 * test actual cryptographic verification logic, not just mocked results.
 * The JWKS endpoint is stubbed via global fetch so no network is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';

// Snapshot the real fetch before any mocking.
const realFetch = globalThis.fetch;

describe('verifyReceiptSignature', () => {
  let publicJwk: ReturnType<typeof exportJWK> extends Promise<infer T> ? T : never;
  let privateKey: CryptoKey;
  let publicKey: CryptoKey;

  beforeEach(async () => {
    vi.resetModules();

    const pair = await generateKeyPair('ES256', { extractable: true });
    privateKey = pair.privateKey as CryptoKey;
    publicKey = pair.publicKey as CryptoKey;
    publicJwk = await exportJWK(publicKey);
    publicJwk.kid = 'test-key-1';
    publicJwk.use = 'sig';
    publicJwk.alg = 'ES256';

    // Stub the JWKS fetch so no network is required.
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url instanceof Request ? url.url : String(url);
      if (urlStr.includes('/.well-known/jwks.json')) {
        return new Response(JSON.stringify({ keys: [publicJwk] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return realFetch(url as Request);
    }) as typeof fetch;
  });

  it('accepts a valid ES256 JWT with correct issuer and unexpired exp', async () => {
    const { verifyReceiptSignature } = await import('@/lib/crypto/receiptVerifier');

    const issuer = process.env.VITACV_ISSUER_URL ?? 'https://vitalcv.com';
    const jwt = await new SignJWT({ receiptId: 'r-001' })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key-1' })
      .setIssuer(issuer)
      .setExpirationTime('1h')
      .setIssuedAt()
      .sign(privateKey);

    const result = await verifyReceiptSignature(jwt);
    expect(result.verified).toBe(true);
    expect(result.payload).not.toBeNull();
    expect(result.payload?.iss).toBe(issuer);
    expect(result.error).toBeUndefined();
  });

  it('rejects a JWT signed with a different (unknown) key', async () => {
    const { verifyReceiptSignature } = await import('@/lib/crypto/receiptVerifier');

    const { privateKey: rogue } = await generateKeyPair('ES256');
    const issuer = process.env.VITACV_ISSUER_URL ?? 'https://vitalcv.com';
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuer(issuer)
      .setExpirationTime('1h')
      .sign(rogue);

    const result = await verifyReceiptSignature(jwt);
    expect(result.verified).toBe(false);
    expect(result.payload).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('rejects an expired JWT', async () => {
    const { verifyReceiptSignature } = await import('@/lib/crypto/receiptVerifier');

    const issuer = process.env.VITACV_ISSUER_URL ?? 'https://vitalcv.com';
    // exp set 2 seconds in the past
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key-1' })
      .setIssuer(issuer)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(privateKey);

    const result = await verifyReceiptSignature(jwt);
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/exp.*claim|expired/i);
  });

  it('rejects a JWT with wrong issuer', async () => {
    const { verifyReceiptSignature } = await import('@/lib/crypto/receiptVerifier');

    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key-1' })
      .setIssuer('https://evil.example.com')
      .setExpirationTime('1h')
      .sign(privateKey);

    const result = await verifyReceiptSignature(jwt);
    expect(result.verified).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects a malformed token string', async () => {
    const { verifyReceiptSignature } = await import('@/lib/crypto/receiptVerifier');

    const result = await verifyReceiptSignature('not.a.jwt');
    expect(result.verified).toBe(false);
    expect(result.payload).toBeNull();
    expect(result.error).toBeTruthy();
  });
});
