/**
 * OID4VP-1 PR324A — JWKS endpoint truth-contract lockdown.
 *
 * Pins the fail-closed semantics of the /.well-known/jwks.json route:
 *   - Missing env var → empty {keys: []} + X-JWKS-Status: not-configured.
 *   - Malformed env JSON → empty {keys: []} + X-JWKS-Status: malformed-env.
 *   - Env JWK shape invalid (no kty, or has private `d` field) →
 *     empty {keys: []} + X-JWKS-Status: invalid-jwk.
 *   - Valid public JWK → {keys: [jwk]} + X-JWKS-Status: ok.
 *
 * The route NEVER fabricates a key and NEVER serves a private key.
 * Verifiers receiving an empty JWKS refuse to validate (fail-closed)
 * rather than getting a falsified-trust source.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GET } from '../app/.well-known/jwks.json/route';

const VITALCV_KEY_VAR = 'VITALCV_SIGNING_PUBLIC_JWK';
const VALID_PUBLIC_JWK = {
  kty: 'EC',
  crv: 'P-256',
  x: 'aB-tQwQ4-fakeBase64UrlX',
  y: 'cd_uVxR5-fakeBase64UrlY',
  use: 'sig',
  alg: 'ES256',
  kid: 'vitalcv-2026-05-11',
};

describe('OID4VP-1 PR324A — /.well-known/jwks.json fail-closed semantics', () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env[VITALCV_KEY_VAR];
    delete process.env[VITALCV_KEY_VAR];
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env[VITALCV_KEY_VAR];
    } else {
      process.env[VITALCV_KEY_VAR] = saved;
    }
  });

  it('absent env → empty JWKS + X-JWKS-Status: not-configured', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('X-JWKS-Status')).toBe('not-configured');
    const body = await res.json();
    expect(body).toEqual({ keys: [] });
  });

  it('empty-string env → empty JWKS + not-configured', async () => {
    process.env[VITALCV_KEY_VAR] = '';
    const res = await GET();
    expect(res.headers.get('X-JWKS-Status')).toBe('not-configured');
    const body = await res.json();
    expect(body.keys).toHaveLength(0);
  });

  it('malformed JSON env → empty JWKS + malformed-env', async () => {
    process.env[VITALCV_KEY_VAR] = 'this is not json{';
    const res = await GET();
    expect(res.headers.get('X-JWKS-Status')).toBe('malformed-env');
    const body = await res.json();
    expect(body.keys).toHaveLength(0);
  });

  it('JSON without kty → empty JWKS + invalid-jwk', async () => {
    process.env[VITALCV_KEY_VAR] = JSON.stringify({ crv: 'P-256', x: 'a', y: 'b' });
    const res = await GET();
    expect(res.headers.get('X-JWKS-Status')).toBe('invalid-jwk');
    const body = await res.json();
    expect(body.keys).toHaveLength(0);
  });

  it('JSON with private `d` field → REJECTED (never serve private material)', async () => {
    process.env[VITALCV_KEY_VAR] = JSON.stringify({
      ...VALID_PUBLIC_JWK,
      d: 'PRIVATE_SHOULD_NEVER_LEAK',
    });
    const res = await GET();
    expect(res.headers.get('X-JWKS-Status')).toBe('invalid-jwk');
    const body = await res.json();
    expect(body.keys).toHaveLength(0);
  });

  it('JSON with kty but null → empty JWKS + invalid-jwk', async () => {
    process.env[VITALCV_KEY_VAR] = JSON.stringify(null);
    const res = await GET();
    expect(res.headers.get('X-JWKS-Status')).toBe('invalid-jwk');
    const body = await res.json();
    expect(body.keys).toHaveLength(0);
  });

  it('JSON array (not object) → empty JWKS + invalid-jwk', async () => {
    process.env[VITALCV_KEY_VAR] = JSON.stringify([VALID_PUBLIC_JWK]);
    const res = await GET();
    expect(res.headers.get('X-JWKS-Status')).toBe('invalid-jwk');
    const body = await res.json();
    expect(body.keys).toHaveLength(0);
  });

  it('valid public JWK → {keys: [jwk]} + X-JWKS-Status: ok', async () => {
    process.env[VITALCV_KEY_VAR] = JSON.stringify(VALID_PUBLIC_JWK);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('X-JWKS-Status')).toBe('ok');
    const body = await res.json();
    expect(body).toEqual({ keys: [VALID_PUBLIC_JWK] });
  });

  it('valid JWK → long Cache-Control (1h fresh, 24h SWR)', async () => {
    process.env[VITALCV_KEY_VAR] = JSON.stringify(VALID_PUBLIC_JWK);
    const res = await GET();
    expect(res.headers.get('Cache-Control')).toContain('max-age=3600');
    expect(res.headers.get('Cache-Control')).toContain('stale-while-revalidate=86400');
  });

  it('not-configured → short Cache-Control (60s fresh, 5min SWR)', async () => {
    const res = await GET();
    expect(res.headers.get('Cache-Control')).toContain('max-age=60');
    expect(res.headers.get('Cache-Control')).toContain('stale-while-revalidate=300');
  });
});

describe('OID4VP-1 PR324A — source-level truth-contract pins', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const ROUTE_SRC = fs.readFileSync(
    path.resolve(__dirname, '../app/.well-known/jwks.json/route.ts'),
    'utf8',
  );

  it('route file never reads VITALCV_SIGNING_PRIVATE_* env vars', () => {
    expect(ROUTE_SRC).not.toMatch(/VITALCV_SIGNING_PRIVATE/);
    expect(ROUTE_SRC).not.toMatch(/SIGNING_KEY_PEM/);
  });

  it('explicit rejection of JWKs that contain `d` (private component)', () => {
    expect(ROUTE_SRC).toContain("'d' in obj");
  });

  it('runtime is nodejs (crypto-safe; not edge)', () => {
    expect(ROUTE_SRC).toContain("export const runtime = 'nodejs'");
  });

  it('does not introduce banned strings', () => {
    const BANNED = [
      ['automatically', 'verified'].join(' '),
      ['guaranteed', 'verification'].join(' '),
      ['HIPAA', 'compliant'].join(' '),
      ['SOC2', 'certified'].join(' '),
      ['certified', 'compliant'].join(' '),
    ];
    for (const phrase of BANNED) {
      expect(ROUTE_SRC).not.toContain(phrase);
    }
  });
});
