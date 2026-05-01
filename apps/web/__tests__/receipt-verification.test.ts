/**
 * Zero-trust receipt JWT verification — vitest suite
 *
 * Tests three scenarios from the VERIFIER-200 spec:
 *   1. A valid JWT passes verification
 *   2. A tampered JWT (modified payload) throws a signature verification error
 *   3. An expired JWT throws an expiration error
 */

import { describe, it, expect } from 'vitest';
import {
  verifyReceiptJwt,
  verifyReceiptJwts,
  resolveReceiptPosture,
  mintTestReceiptJwt,
  DEV_FALLBACK_SECRET,
} from '../lib/receipt-verification';

const SECRET = DEV_FALLBACK_SECRET;
const ALT_SECRET = 'totally-different-secret-min32bytes--ok!';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Replace the payload segment of a compact JWT with a different base64url string. */
function tamperPayload(token: string, newPayload: Record<string, unknown>): string {
  const [header, , signature] = token.split('.');
  const fraudPayload = Buffer.from(JSON.stringify(newPayload)).toString('base64url');
  return `${header}.${fraudPayload}.${signature}`;
}

// ── 1. Valid JWT ──────────────────────────────────────────────────────────────

describe('verifyReceiptJwt — valid token', () => {
  it('returns ok:true with the original claims', async () => {
    const token = await mintTestReceiptJwt(
      { sub: 'npi:1234567890', type: 'receipt_candidate' },
      { expiresIn: '1h', secret: SECRET },
    );

    const result = await verifyReceiptJwt(token, SECRET);

    expect(result.ok).toBe(true);
    if (!result.ok) return; // narrow type

    expect(result.claims.sub).toBe('npi:1234567890');
    expect(result.claims.type).toBe('receipt_candidate');
  });

  it('resolves to "secured" posture for an array of all-valid tokens', async () => {
    const t1 = await mintTestReceiptJwt({ sub: 'a' }, { secret: SECRET });
    const t2 = await mintTestReceiptJwt({ sub: 'b' }, { secret: SECRET });

    const results = await verifyReceiptJwts([t1, t2], SECRET);
    expect(resolveReceiptPosture(results)).toBe('secured');
  });
});

// ── 2. Tampered JWT (modified payload) ───────────────────────────────────────

describe('verifyReceiptJwt — tampered payload', () => {
  it('returns ok:false with error:"signature_invalid" when payload is modified', async () => {
    const original = await mintTestReceiptJwt(
      { sub: 'npi:1234567890', role: 'clinician' },
      { expiresIn: '1h', secret: SECRET },
    );

    // Swap role to 'admin' without re-signing
    const tampered = tamperPayload(original, {
      sub: 'npi:1234567890',
      role: 'admin',
    });

    const result = await verifyReceiptJwt(tampered, SECRET);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('signature_invalid');
  });

  it('resolves to "compromised" posture when any token is tampered', async () => {
    const valid = await mintTestReceiptJwt({ sub: 'a' }, { secret: SECRET });
    const original = await mintTestReceiptJwt({ sub: 'b', role: 'clinician' }, { secret: SECRET });
    const tampered = tamperPayload(original, { sub: 'b', role: 'admin' });

    const results = await verifyReceiptJwts([valid, tampered], SECRET);
    expect(resolveReceiptPosture(results)).toBe('compromised');
  });

  it('returns ok:false with error:"signature_invalid" when signed with a different secret', async () => {
    const token = await mintTestReceiptJwt(
      { sub: 'npi:1234567890' },
      { expiresIn: '1h', secret: ALT_SECRET },
    );

    const result = await verifyReceiptJwt(token, SECRET);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('signature_invalid');
  });
});

// ── 3. Expired JWT ────────────────────────────────────────────────────────────

describe('verifyReceiptJwt — expired token', () => {
  it('returns ok:false with error:"expired" for a token expired in the past', async () => {
    const token = await mintTestReceiptJwt(
      { sub: 'npi:1234567890' },
      // jose accepts relative time strings; negative delta = already expired
      { expiresIn: '-1s', secret: SECRET },
    );

    const result = await verifyReceiptJwt(token, SECRET);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('expired');
  });

  it('resolves to "expired" posture (not "compromised") when only expiry fails', async () => {
    const valid   = await mintTestReceiptJwt({ sub: 'a' }, { secret: SECRET });
    const expired = await mintTestReceiptJwt({ sub: 'b' }, { expiresIn: '-1s', secret: SECRET });

    const results = await verifyReceiptJwts([valid, expired], SECRET);
    expect(resolveReceiptPosture(results)).toBe('expired');
  });
});

// ── 4. Posture edge cases ─────────────────────────────────────────────────────

describe('resolveReceiptPosture', () => {
  it('returns "pending" for an empty result array', () => {
    expect(resolveReceiptPosture([])).toBe('pending');
  });

  it('prefers "compromised" over "expired" when both are present', async () => {
    const expired  = await mintTestReceiptJwt({ sub: 'a' }, { expiresIn: '-1s', secret: SECRET });
    const original = await mintTestReceiptJwt({ sub: 'b' }, { secret: SECRET });
    const tampered = tamperPayload(original, { sub: 'b', role: 'hacker' });

    const results = await verifyReceiptJwts([expired, tampered], SECRET);
    expect(resolveReceiptPosture(results)).toBe('compromised');
  });
});
