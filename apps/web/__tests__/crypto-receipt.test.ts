/**
 * crypto-receipt.test.ts
 *
 * Validates the ES256 receipt issuer, JWKS key-safety contract, and that the
 * employer-facing review surface contains no overreaching copy.
 */

import { describe, it, expect } from 'vitest';
import { generateKeyPair, SignJWT, decodeProtectedHeader, exportJWK } from 'jose';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// 1. ES256 JWT signing
// ---------------------------------------------------------------------------

describe('ES256 JWT signing', () => {
  it('produces a three-part JWT with correct alg and kid in the protected header', async () => {
    const { privateKey } = await generateKeyPair('ES256', { extractable: true });

    const jwt = await new SignJWT({ receiptId: 'r-001', orchestrator: 'vitalcv' })
      .setProtectedHeader({ alg: 'ES256', kid: 'vitalcv-trust-key-1' })
      .setIssuer('https://vitalcv.com')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    // Must be a three-segment compact serialization.
    expect(jwt.split('.').length).toBe(3);

    const header = decodeProtectedHeader(jwt);
    expect(header.alg).toBe('ES256');
    expect(header.kid).toBe('vitalcv-trust-key-1');
  });

  it('produces distinct signatures for distinct payloads (non-deterministic signing)', async () => {
    const { privateKey } = await generateKeyPair('ES256', { extractable: true });
    const base = { alg: 'ES256' as const, kid: 'k1' };

    const [j1, j2] = await Promise.all([
      new SignJWT({ n: 1 }).setProtectedHeader(base).setIssuer('https://vitalcv.com').setIssuedAt().sign(privateKey),
      new SignJWT({ n: 2 }).setProtectedHeader(base).setIssuer('https://vitalcv.com').setIssuedAt().sign(privateKey),
    ]);

    expect(j1).not.toBe(j2);
  });

  it('exports a public JWK without private key material (no d field)', async () => {
    const { publicKey } = await generateKeyPair('ES256', { extractable: true });
    const jwk = await exportJWK(publicKey);

    expect(jwk).not.toHaveProperty('d');
    expect(jwk.kty).toBe('EC');
    expect(jwk.crv).toBe('P-256');
    expect(jwk.x).toBeTruthy();
    expect(jwk.y).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 2. JWKS endpoint key-safety contract
// ---------------------------------------------------------------------------

describe('JWKS public key contract', () => {
  it('getPublicKeyJwk returns only public EC key fields — no private d parameter', async () => {
    // Import from the canonical ES256 receipt issuer module.
    const { getPublicKeyJwk } = await import('@/lib/crypto/receiptIssuer');
    const jwk = await getPublicKeyJwk();

    // Private key component — must never be present in JWKS response.
    expect(jwk).not.toHaveProperty('d');

    // Required public-key fields for ES256 / P-256.
    expect(jwk.kty).toBe('EC');
    expect(jwk.crv).toBe('P-256');
    expect(jwk.use).toBe('sig');
    expect(jwk.alg).toBe('ES256');
    expect(jwk.kid).toBeTruthy();
    expect(jwk.x).toBeTruthy();
    expect(jwk.y).toBeTruthy();
  });

  it('JWKS response shape wraps public key in a keys array', async () => {
    const { getPublicKeyJwk } = await import('@/lib/crypto/receiptIssuer');
    const jwk = await getPublicKeyJwk();

    // Simulate what the GET handler returns.
    const jwks = { keys: [jwk] };

    expect(Array.isArray(jwks.keys)).toBe(true);
    expect(jwks.keys.length).toBeGreaterThan(0);
    for (const key of jwks.keys) {
      expect(key).not.toHaveProperty('d');
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Employer UI copy contract — no blockchain overclaiming
// ---------------------------------------------------------------------------

describe('Employer review UI copy', () => {
  const reviewClientSrc = readFileSync(
    resolve(__dirname, '../components/review/ReviewClient.tsx'),
    'utf8',
  );

  // The word "blockchain" is banned from credentialing copy — VitalCV uses
  // cryptographic signatures, not distributed ledger claims.
  it('does not contain the word "blockchain" in ReviewClient source', () => {
    expect(reviewClientSrc.toLowerCase()).not.toMatch(/\bblockchain\b/);
  });

  it('uses the correct VitalCV orchestration agent copy', () => {
    expect(reviewClientSrc).toContain(
      'cryptographically signed by VitalCV as the orchestration agent',
    );
  });

  it('labels the panel as "Cryptographic Receipt Available" — not "blockchain"', () => {
    expect(reviewClientSrc).toContain('Cryptographic Receipt Available');
  });

  it('links to the JWKS endpoint for independent verification', () => {
    expect(reviewClientSrc).toContain('/.well-known/jwks.json');
  });
});
