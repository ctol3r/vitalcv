import { describe, expect, it } from 'vitest';
import { signPayloadES256 } from '../lib/trust/cryptoService';
import { verifyReceiptJWT } from '../lib/trust/jwtVerifier';

// Helper: build a minimal valid payload
function makePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: 'application:test-123',
    iss: 'vitalcv',
    iat: now,
    exp: now + 3600,
    proofTier: 'psv_receipt',
    ...overrides,
  };
}

describe('verifyReceiptJWT', () => {
  it('verifies a freshly-signed valid token successfully', async () => {
    const token = await signPayloadES256(makePayload());
    const result = await verifyReceiptJWT(token);
    expect(result.verified).toBe(true);
    expect(result.payload).toBeDefined();
    expect(result.payload?.iss).toBe('vitalcv');
    expect(result.error).toBeUndefined();
  });

  it('rejects a token with a tampered payload (flipped character in middle segment)', async () => {
    const token = await signPayloadES256(makePayload());
    const [header, payload, sig] = token.split('.');
    // Flip one character in the payload segment
    const tamperedPayload = payload.slice(0, -1) + (payload.endsWith('A') ? 'B' : 'A');
    const tampered = `${header}.${tamperedPayload}.${sig}`;
    const result = await verifyReceiptJWT(tampered);
    expect(result.verified).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects a token with a garbage signature', async () => {
    const token = await signPayloadES256(makePayload());
    const [header, payload] = token.split('.');
    const garbageSig = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const tampered = `${header}.${payload}.${garbageSig}`;
    const result = await verifyReceiptJWT(tampered);
    expect(result.verified).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects an expired token (exp in the past)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signPayloadES256(makePayload({
      iat: now - 7200,
      exp: now - 3600, // expired 1 hour ago
    }));
    const result = await verifyReceiptJWT(token);
    expect(result.verified).toBe(false);
    expect(result.error).toBeDefined();
    // jose reports expiration as JWTExpired
    expect(result.errorCode).toBe('token_expired');
  });

  it('rejects a token signed with HS256 (wrong algorithm)', async () => {
    // Manually construct a HS256-signed JWT (not using our cryptoService)
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
      sub: 'test',
      iss: 'vitalcv',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');
    // Use a fake HMAC signature (not actually valid HMAC either, but alg rejection fires first)
    const fakeSignature = Buffer.from('fake-hmac-signature').toString('base64url');
    const hs256Token = `${header}.${payload}.${fakeSignature}`;

    const result = await verifyReceiptJWT(hs256Token);
    expect(result.verified).toBe(false);
    expect(result.error).toBeDefined();
    // jose rejects HS256 when only ES256 is allowed — algorithm_rejected or signature_invalid
    expect(['algorithm_rejected', 'signature_invalid', 'unknown']).toContain(result.errorCode);
  });
});
