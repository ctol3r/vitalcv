import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetBuckets } from '@/lib/rate-limit/ipBucket';

beforeEach(() => {
  __resetBuckets();
  vi.resetModules();
  delete process.env.VCV_ISSUER_HOST;
  delete process.env.VCV_ED25519_PRIVATE_JWK;
});

afterEach(() => {
  __resetBuckets();
  vi.restoreAllMocks();
});

// ── resolve-npi route + cache ────────────────────────────────────────────

describe('resolve-npi route', () => {
  async function callRoute(
    npi: string,
    headers: HeadersInit = {},
  ): Promise<Response> {
    const mod = await import('@/app/api/resolve-npi/route');
    mod.__resetResolveNpiCache();
    const req = {
      nextUrl: new URL(`http://localhost/api/resolve-npi?npi=${npi}`),
      headers: new Headers(headers),
    } as unknown as import('next/server').NextRequest;
    return mod.GET(req);
  }

  async function callRouteWithSharedCache(
    npi: string,
    headers: HeadersInit = {},
  ): Promise<Response> {
    // Re-uses the cache between calls — no reset.
    const mod = await import('@/app/api/resolve-npi/route');
    const req = {
      nextUrl: new URL(`http://localhost/api/resolve-npi?npi=${npi}`),
      headers: new Headers(headers),
    } as unknown as import('next/server').NextRequest;
    return mod.GET(req);
  }

  it('rejects invalid format with 400', async () => {
    const res = await callRoute('abc');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_npi_format');
  });

  it('rejects bad Luhn with 400', async () => {
    const res = await callRoute('1234567890');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_npi_checksum');
  });

  it('returns 404 when NPPES has no result for the NPI', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ result_count: 0, results: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch;
    const res = await callRoute('1346053246', {
      'x-forwarded-for': '198.51.100.10',
    });
    expect(res.status).toBe(404);
  });

  it('returns 200 + DTO on success and projects fields from NPPES', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          result_count: 1,
          results: [
            {
              number: '1346053246',
              basic: {
                first_name: 'Mira',
                last_name: 'Chen',
                credential: 'MD',
              },
              taxonomies: [
                {
                  code: '207R00000X',
                  desc: 'Internal Medicine',
                  primary: true,
                  state: 'CA',
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;
    const res = await callRoute('1346053246', {
      'x-forwarded-for': '198.51.100.11',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.firstName).toBe('Mira');
    expect(body.lastName).toBe('Chen');
    expect(body.credential).toBe('MD');
    expect(body.primaryTaxonomy.code).toBe('207R00000X');
    expect(body.activeState).toBe('CA');
    expect(body.cached).toBe(false);
    expect(res.headers.get('X-Cache')).toBe('MISS');
  });

  it('serves repeat fetches from the cache (<300ms latency contract)', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          result_count: 1,
          results: [
            {
              basic: { first_name: 'A', last_name: 'B' },
              taxonomies: [{ code: '207R00000X', primary: true }],
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    // First call - MISS
    const first = await callRoute('1346053246', {
      'x-forwarded-for': '198.51.100.12',
    });
    expect(first.headers.get('X-Cache')).toBe('MISS');
    // Second call uses shared cache - HIT, no upstream call
    const start = performance.now();
    const second = await callRouteWithSharedCache('1346053246', {
      'x-forwarded-for': '198.51.100.13',
    });
    const elapsed = performance.now() - start;
    expect(second.status).toBe(200);
    expect(second.headers.get('X-Cache')).toBe('HIT');
    expect((await second.json()).cached).toBe(true);
    expect(elapsed).toBeLessThan(300);
    // Upstream fetch only invoked once across the two calls
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rate-limits at 30 requests / minute per IP', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ result_count: 0, results: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch;
    const ip = '198.51.100.99';
    for (let i = 0; i < 30; i++) {
      await callRouteWithSharedCache('1346053246', { 'x-forwarded-for': ip });
    }
    const denied = await callRouteWithSharedCache('1346053246', {
      'x-forwarded-for': ip,
    });
    expect(denied.status).toBe(429);
    expect(denied.headers.get('Retry-After')).toBeTruthy();
  });
});

// ── /.well-known/did.json ────────────────────────────────────────────────

describe('.well-known/did.json route · W3C DID compliance', () => {
  async function callDid(headers: HeadersInit = {}): Promise<Response> {
    const mod = await import('@/app/.well-known/did.json/route');
    return mod.GET(new Request('https://example.com/.well-known/did.json', {
      headers,
    }));
  }

  it('returns a strict W3C DID Document with did:web identity', async () => {
    const res = await callDid({ 'x-forwarded-host': 'demo.trycloudflare.com' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/did\+json/);
    const body = await res.json();
    expect(body['@context']).toContain('https://www.w3.org/ns/did/v1');
    expect(body.id).toBe('did:web:demo.trycloudflare.com');
    expect(body.controller).toBe('did:web:demo.trycloudflare.com');
  });

  it('exposes an Ed25519 verification method (JsonWebKey2020 with crv: Ed25519)', async () => {
    const res = await callDid({ 'x-forwarded-host': 'demo.trycloudflare.com' });
    const body = await res.json();
    expect(body.verificationMethod).toHaveLength(1);
    const vm = body.verificationMethod[0];
    expect(vm.type).toBe('JsonWebKey2020');
    expect(vm.publicKeyJwk.kty).toBe('OKP');
    expect(vm.publicKeyJwk.crv).toBe('Ed25519');
    expect(vm.publicKeyJwk.alg).toBe('EdDSA');
    expect(vm.id).toMatch(/^did:web:demo\.trycloudflare\.com#/);
  });

  it('lists the verification method in authentication and assertionMethod', async () => {
    const res = await callDid();
    const body = await res.json();
    const vmId = body.verificationMethod[0].id;
    expect(body.authentication).toContain(vmId);
    expect(body.assertionMethod).toContain(vmId);
  });

  it('advertises the JWKS and OID4VCI service endpoints', async () => {
    const res = await callDid({ 'x-forwarded-host': 'demo.example.com' });
    const body = await res.json();
    const services = body.service as Array<{ type: string; serviceEndpoint: string }>;
    const jwks = services.find((s) => s.type === 'KeyStore');
    const oid4vci = services.find((s) => s.type === 'OID4VCIIssuer');
    expect(jwks?.serviceEndpoint).toBe('https://demo.example.com/.well-known/jwks.json');
    expect(oid4vci?.serviceEndpoint).toBe(
      'https://demo.example.com/.well-known/openid-credential-issuer',
    );
  });

  it('falls back to vitalcv.com when no host header is supplied', async () => {
    const res = await callDid({});
    const body = await res.json();
    expect(body.id).toBe('did:web:vitalcv.com');
  });
});

// ── /.well-known/openid-credential-issuer ───────────────────────────────

describe('.well-known/openid-credential-issuer route · OID4VCI compliance', () => {
  async function callOid4vci(headers: HeadersInit = {}): Promise<Response> {
    const mod = await import(
      '@/app/.well-known/openid-credential-issuer/route'
    );
    return mod.GET(
      new Request('https://example.com/.well-known/openid-credential-issuer', {
        headers,
      }),
    );
  }

  it('returns OID4VCI 1.0 metadata with required fields', async () => {
    const res = await callOid4vci({ 'x-forwarded-host': 'demo.example.com' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.credential_issuer).toBe('https://demo.example.com');
    expect(body.credential_endpoint).toBe(
      'https://demo.example.com/api/credentials/issue',
    );
    expect(body.jwks_uri).toBe('https://demo.example.com/.well-known/jwks.json');
    expect(body.authorization_servers).toEqual(['https://demo.example.com']);
  });

  it('declares VitalCVCredential in credential_configurations_supported', async () => {
    const res = await callOid4vci();
    const body = await res.json();
    const cred = body.credential_configurations_supported.VitalCVCredential;
    expect(cred).toBeTruthy();
    expect(cred.format).toBe('jwt_vc_json');
    expect(cred.credential_definition.type).toContain('VerifiableCredential');
    expect(cred.credential_definition.type).toContain('VitalCVCredential');
    expect(cred.credential_signing_alg_values_supported).toContain('EdDSA');
    expect(cred.proof_types_supported.jwt.proof_signing_alg_values_supported)
      .toContain('EdDSA');
  });

  it('declares subject claims (npi, taxonomyCode, activeState) on the credential', async () => {
    const res = await callOid4vci();
    const body = await res.json();
    const subject =
      body.credential_configurations_supported.VitalCVCredential
        .credential_definition.credentialSubject;
    expect(subject.npi).toBeTruthy();
    expect(subject.taxonomyCode).toBeTruthy();
    expect(subject.activeState).toBeTruthy();
  });

  it('cross-references the issuer DID', async () => {
    const res = await callOid4vci({ 'x-forwarded-host': 'demo.example.com' });
    const body = await res.json();
    expect(body.issuer_did).toBe('did:web:demo.example.com');
  });
});
