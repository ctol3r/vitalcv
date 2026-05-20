import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PROTOCOL_CACHE_CONTROL,
  PROTOCOL_VARY_HEADER,
  buildCanonicalJsonResponse,
  canonicalSerialize,
  canonicalizeHost,
  computeETag,
  hostToDidWeb,
  ifNoneMatchMatches,
} from '@/lib/protocol/protocolIntegrity';
import {
  DEFAULT_ISSUER_HOST,
  resolveIssuerDid,
  resolveIssuerHost,
  resolveIssuerOrigin,
} from '@/lib/discovery/issuerHost';
import { __resetEd25519IssuerKey } from '@/lib/crypto/ed25519IssuerKey';

beforeEach(() => {
  delete process.env.VCV_ISSUER_HOST;
  vi.resetModules();
  __resetEd25519IssuerKey();
});

afterEach(() => {
  delete process.env.VCV_ISSUER_HOST;
  vi.restoreAllMocks();
  __resetEd25519IssuerKey();
});

// ── canonicalSerialize ────────────────────────────────────────────────────

describe('canonicalSerialize', () => {
  it('sorts object keys lexicographically', () => {
    expect(canonicalSerialize({ c: 1, a: 2, b: 3 })).toBe(
      '{"a":2,"b":3,"c":1}',
    );
  });

  it('recurses into nested objects and preserves array order', () => {
    const a = { x: { z: 1, y: 2 }, arr: [{ b: 1, a: 2 }, { d: 1, c: 2 }] };
    const b = { arr: [{ a: 2, b: 1 }, { c: 2, d: 1 }], x: { y: 2, z: 1 } };
    expect(canonicalSerialize(a)).toBe(canonicalSerialize(b));
  });

  it('two equivalent inputs produce byte-identical output', () => {
    const fixture = {
      '@context': ['ctx-1', 'ctx-2'],
      verificationMethod: [{ id: 'vm-1', type: 'JsonWebKey2020' }],
      id: 'did:web:host',
      service: [
        { id: 'svc-1', type: 'JWKS' },
        { id: 'svc-2', type: 'OID4VCI' },
      ],
    };
    const clone = JSON.parse(JSON.stringify(fixture));
    expect(canonicalSerialize(fixture)).toBe(canonicalSerialize(clone));
  });

  it('handles null + primitives faithfully', () => {
    expect(canonicalSerialize(null)).toBe('null');
    expect(canonicalSerialize(0)).toBe('0');
    expect(canonicalSerialize(false)).toBe('false');
    expect(canonicalSerialize('a')).toBe('"a"');
  });
});

// ── computeETag + ifNoneMatchMatches ──────────────────────────────────────

describe('computeETag', () => {
  it('renders as a quoted 16-hex strong ETag', () => {
    const e = computeETag('{"a":1}');
    expect(e).toMatch(/^"[0-9a-f]{16}"$/);
  });

  it('is deterministic for identical inputs', () => {
    expect(computeETag('{"a":1}')).toBe(computeETag('{"a":1}'));
  });

  it('changes on any input mutation', () => {
    expect(computeETag('{"a":1}')).not.toBe(computeETag('{"a":2}'));
  });
});

describe('ifNoneMatchMatches', () => {
  const etag = '"abcd1234abcd1234"';
  it('returns true on exact strong match', () => {
    expect(ifNoneMatchMatches(etag, etag)).toBe(true);
  });
  it('returns true on weak-form variant', () => {
    expect(ifNoneMatchMatches(`W/${etag}`, etag)).toBe(true);
  });
  it('returns true on wildcard', () => {
    expect(ifNoneMatchMatches('*', etag)).toBe(true);
  });
  it('returns true when the etag appears in a comma-separated list', () => {
    expect(
      ifNoneMatchMatches(`"other", ${etag}, "yet-another"`, etag),
    ).toBe(true);
  });
  it('returns false on null / undefined / empty headers', () => {
    expect(ifNoneMatchMatches(null, etag)).toBe(false);
    expect(ifNoneMatchMatches(undefined, etag)).toBe(false);
    expect(ifNoneMatchMatches('', etag)).toBe(false);
  });
  it('returns false on a mismatched etag', () => {
    expect(ifNoneMatchMatches('"different"', etag)).toBe(false);
  });
});

// ── canonicalizeHost · injection-vector battery ───────────────────────────

describe('canonicalizeHost · acceptance', () => {
  it.each([
    ['vitalcv.com', 'vitalcv.com'],
    ['VitalCV.COM', 'vitalcv.com'], // case-insensitive normalization
    ['demo-tunnel.trycloudflare.com', 'demo-tunnel.trycloudflare.com'],
    ['localhost', 'localhost'],
    ['localhost:3000', 'localhost:3000'],
    ['app.vitalcv.com:8443', 'app.vitalcv.com:8443'],
    ['a.b.c.d.example', 'a.b.c.d.example'],
    ['preview-1234.vercel.app', 'preview-1234.vercel.app'],
  ])('accepts "%s" → "%s"', (input, expected) => {
    expect(canonicalizeHost(input)).toBe(expected);
  });
});

describe('canonicalizeHost · rejection', () => {
  it('rejects null and undefined', () => {
    expect(canonicalizeHost(null)).toBeNull();
    expect(canonicalizeHost(undefined)).toBeNull();
  });

  it('rejects non-string inputs', () => {
    expect(canonicalizeHost(123 as unknown as string)).toBeNull();
    expect(canonicalizeHost({} as unknown as string)).toBeNull();
  });

  it('rejects empty / whitespace-only inputs', () => {
    expect(canonicalizeHost('')).toBeNull();
    expect(canonicalizeHost('   ')).toBeNull();
  });

  it('rejects path / query / fragment injection', () => {
    expect(canonicalizeHost('evil.com/.well-known')).toBeNull();
    expect(canonicalizeHost('evil.com?q=1')).toBeNull();
    expect(canonicalizeHost('evil.com#fragment')).toBeNull();
  });

  it('rejects scheme separator', () => {
    expect(canonicalizeHost('https://evil.com')).toBeNull();
    expect(canonicalizeHost('evil.com://attack')).toBeNull();
  });

  it('rejects whitespace / tab / newline inside host', () => {
    expect(canonicalizeHost('evil .com')).toBeNull();
    expect(canonicalizeHost('evil\tcom')).toBeNull();
    expect(canonicalizeHost('evil\ncom')).toBeNull();
  });

  it('rejects control characters', () => {
    expect(canonicalizeHost('evil\x00com')).toBeNull();
    expect(canonicalizeHost('evil\x7Fcom')).toBeNull();
  });

  it('rejects non-ASCII unicode codepoints', () => {
    expect(canonicalizeHost('evil.cölm')).toBeNull();
  });

  it('rejects port out of range / zero / non-numeric / multiple colons', () => {
    expect(canonicalizeHost('evil.com:99999')).toBeNull();
    expect(canonicalizeHost('evil.com:0')).toBeNull();
    expect(canonicalizeHost('evil.com:abc')).toBeNull();
    expect(canonicalizeHost('evil.com:80:81')).toBeNull();
  });

  it('rejects oversized hosts (>253 chars per RFC 1035)', () => {
    expect(canonicalizeHost('a'.repeat(254))).toBeNull();
  });

  it('rejects leading dash (HOST_PATTERN requires alphanumeric first char)', () => {
    expect(canonicalizeHost('-leading-dash.com')).toBeNull();
  });
});

describe('canonicalizeHost · port handling', () => {
  it('accepts the lowest valid port', () => {
    expect(canonicalizeHost('h.example:1')).toBe('h.example:1');
  });
  it('accepts the highest valid port', () => {
    expect(canonicalizeHost('h.example:65535')).toBe('h.example:65535');
  });
  it('rejects port exactly at 65536', () => {
    expect(canonicalizeHost('h.example:65536')).toBeNull();
  });
});

// ── hostToDidWeb ──────────────────────────────────────────────────────────

describe('hostToDidWeb', () => {
  it('renders a plain host as did:web:<host>', () => {
    expect(hostToDidWeb('vitalcv.com')).toBe('did:web:vitalcv.com');
  });
  it('percent-encodes the colon when a port is present', () => {
    expect(hostToDidWeb('localhost:3000')).toBe('did:web:localhost%3A3000');
  });
});

// ── issuerHost resolution + Vary / Cache constants ────────────────────────

describe('resolveIssuerHost · precedence + canonicalization', () => {
  it('VCV_ISSUER_HOST env wins over headers', () => {
    process.env.VCV_ISSUER_HOST = 'env.example.com';
    const h = new Headers({
      'x-forwarded-host': 'fwd.example.com',
      host: 'host.example.com',
    });
    expect(resolveIssuerHost(h)).toBe('env.example.com');
  });

  it('X-Forwarded-Host first hop wins over Host', () => {
    const h = new Headers({
      'x-forwarded-host': 'fwd.example.com, internal.example.com',
      host: 'host.example.com',
    });
    expect(resolveIssuerHost(h)).toBe('fwd.example.com');
  });

  it('Host header is the final fallback before default', () => {
    const h = new Headers({ host: 'h.example.com' });
    expect(resolveIssuerHost(h)).toBe('h.example.com');
  });

  it('defaults to vitalcv.com when no header is supplied', () => {
    expect(resolveIssuerHost(new Headers())).toBe(DEFAULT_ISSUER_HOST);
  });

  it('rejects every malformed env value and falls through to the default', () => {
    for (const bad of [
      'evil.com/path',
      'evil.com://attack',
      'evil.com:99999',
      'evil .com',
      'xn--bad host',
      '\x00\x01',
    ]) {
      process.env.VCV_ISSUER_HOST = bad;
      expect(resolveIssuerHost(new Headers())).toBe(DEFAULT_ISSUER_HOST);
    }
  });

  it('lowercases the resolved host (RFC 3986 case-insensitive)', () => {
    process.env.VCV_ISSUER_HOST = 'MixedCASE.Example.Com';
    expect(resolveIssuerHost(new Headers())).toBe('mixedcase.example.com');
  });

  it('rejects a malicious X-Forwarded-Host and falls back to Host', () => {
    const h = new Headers({
      'x-forwarded-host': 'evil.com/inject',
      host: 'safe.example.com',
    });
    expect(resolveIssuerHost(h)).toBe('safe.example.com');
  });

  it('resolveIssuerOrigin prefixes https://', () => {
    const h = new Headers({ host: 'h.example.com' });
    expect(resolveIssuerOrigin(h)).toBe('https://h.example.com');
  });

  it('resolveIssuerDid renders as did:web:<host>', () => {
    const h = new Headers({ host: 'h.example.com' });
    expect(resolveIssuerDid(h)).toBe('did:web:h.example.com');
  });
});

// ── buildCanonicalJsonResponse · envelope contract ────────────────────────

describe('buildCanonicalJsonResponse', () => {
  it('returns 200 + canonical body + strong ETag + Vary + Cache-Control on first hit', () => {
    const out = buildCanonicalJsonResponse({
      value: { z: 1, a: 2 },
      contentType: 'application/did+json',
    });
    expect(out.status).toBe(200);
    expect(out.body).toBe('{"a":2,"z":1}');
    expect(out.headers.ETag).toMatch(/^"[0-9a-f]{16}"$/);
    expect(out.headers.Vary).toBe(PROTOCOL_VARY_HEADER);
    expect(out.headers['Cache-Control']).toBe(PROTOCOL_CACHE_CONTROL);
    expect(out.headers['Content-Type']).toBe('application/did+json');
  });

  it('returns 304 + null body when If-None-Match matches', () => {
    const first = buildCanonicalJsonResponse({
      value: { a: 1 },
      contentType: 'application/json',
    });
    const second = buildCanonicalJsonResponse({
      value: { a: 1 },
      contentType: 'application/json',
      ifNoneMatch: first.headers.ETag,
    });
    expect(second.status).toBe(304);
    expect(second.body).toBeNull();
    expect(second.headers.ETag).toBe(first.headers.ETag);
  });

  it('produces byte-identical body across calls with equivalent inputs', () => {
    const a = buildCanonicalJsonResponse({
      value: { a: { x: 1, y: 2 }, arr: [{ b: 1, a: 2 }] },
      contentType: 'application/json',
    });
    const b = buildCanonicalJsonResponse({
      value: { arr: [{ a: 2, b: 1 }], a: { y: 2, x: 1 } },
      contentType: 'application/json',
    });
    expect(a.body).toBe(b.body);
    expect(a.headers.ETag).toBe(b.headers.ETag);
  });
});

// ── /.well-known/did.json · integrity ─────────────────────────────────────

describe('did.json route · protocol integrity', () => {
  async function callDid(headers: HeadersInit = {}): Promise<Response> {
    const mod = await import('@/app/.well-known/did.json/route');
    return mod.GET(
      new Request('https://example.com/.well-known/did.json', { headers }),
    );
  }

  it('emits application/did+json + Cache-Control + Vary + ETag', async () => {
    const res = await callDid({ 'x-forwarded-host': 'demo.example.com' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/did\+json/);
    expect(res.headers.get('Cache-Control')).toMatch(/public, max-age=3600/);
    expect(res.headers.get('Vary')).toMatch(/Host/);
    expect(res.headers.get('Vary')).toMatch(/X-Forwarded-Host/);
    expect(res.headers.get('ETag')).toMatch(/^"[0-9a-f]{16}"$/);
  });

  it('body is canonically serialized (sorted top-level keys)', async () => {
    const res = await callDid({ 'x-forwarded-host': 'demo.example.com' });
    const text = await res.text();
    // Sorted: @context, assertionMethod, authentication, controller, id,
    // service, verificationMethod
    const firstKey = text.match(/^\{"([^"]+)":/)?.[1];
    expect(firstKey).toBe('@context');
  });

  it('two calls with the same host produce identical ETags (deterministic rendering)', async () => {
    const a = await callDid({ 'x-forwarded-host': 'demo.example.com' });
    const b = await callDid({ 'x-forwarded-host': 'demo.example.com' });
    expect(a.headers.get('ETag')).toBe(b.headers.get('ETag'));
  });

  it('returns 304 with the matching If-None-Match header', async () => {
    const first = await callDid({ 'x-forwarded-host': 'demo.example.com' });
    const etag = first.headers.get('ETag')!;
    const second = await callDid({
      'x-forwarded-host': 'demo.example.com',
      'if-none-match': etag,
    });
    expect(second.status).toBe(304);
    expect(await second.text()).toBe('');
  });

  it('different hosts produce different ETags (no cache poisoning)', async () => {
    const a = await callDid({ 'x-forwarded-host': 'host-a.example.com' });
    const b = await callDid({ 'x-forwarded-host': 'host-b.example.com' });
    expect(a.headers.get('ETag')).not.toBe(b.headers.get('ETag'));
  });

  it('verification method is rendered once (stable single-entry array)', async () => {
    const res = await callDid({ 'x-forwarded-host': 'demo.example.com' });
    const body = JSON.parse(await res.text());
    expect(body.verificationMethod).toHaveLength(1);
    expect(body.verificationMethod[0].type).toBe('JsonWebKey2020');
    expect(body.verificationMethod[0].publicKeyJwk.crv).toBe('Ed25519');
  });

  it('rejects a poisoned X-Forwarded-Host and falls back to Host', async () => {
    const res = await callDid({
      'x-forwarded-host': 'evil.example.com/inject',
      host: 'safe.example.com',
    });
    const body = JSON.parse(await res.text());
    expect(body.id).toBe('did:web:safe.example.com');
  });
});

// ── /.well-known/openid-credential-issuer · integrity ─────────────────────

describe('openid-credential-issuer route · protocol integrity', () => {
  async function callOid4vci(headers: HeadersInit = {}): Promise<Response> {
    const mod = await import(
      '@/app/.well-known/openid-credential-issuer/route'
    );
    return mod.GET(
      new Request(
        'https://example.com/.well-known/openid-credential-issuer',
        { headers },
      ),
    );
  }

  it('emits application/json + Cache-Control + Vary + ETag', async () => {
    const res = await callOid4vci({ 'x-forwarded-host': 'demo.example.com' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/application\/json/);
    expect(res.headers.get('Cache-Control')).toMatch(/public, max-age=3600/);
    expect(res.headers.get('Vary')).toMatch(/X-Forwarded-Host/);
    expect(res.headers.get('ETag')).toMatch(/^"[0-9a-f]{16}"$/);
  });

  it('returns 304 with the matching If-None-Match header', async () => {
    const first = await callOid4vci({
      'x-forwarded-host': 'demo.example.com',
    });
    const etag = first.headers.get('ETag')!;
    const second = await callOid4vci({
      'x-forwarded-host': 'demo.example.com',
      'if-none-match': etag,
    });
    expect(second.status).toBe(304);
  });

  it('body is canonically serialized; same input → same bytes', async () => {
    const a = await callOid4vci({ 'x-forwarded-host': 'demo.example.com' });
    const b = await callOid4vci({ 'x-forwarded-host': 'demo.example.com' });
    expect(await a.text()).toBe(await b.text());
  });

  it('declares the four canonical OID4VCI top-level fields', async () => {
    const res = await callOid4vci({ 'x-forwarded-host': 'demo.example.com' });
    const body = JSON.parse(await res.text());
    expect(body.credential_issuer).toBe('https://demo.example.com');
    expect(body.credential_endpoint).toBe(
      'https://demo.example.com/api/credentials/issue',
    );
    expect(body.jwks_uri).toBe(
      'https://demo.example.com/.well-known/jwks.json',
    );
    expect(body.authorization_servers).toEqual(['https://demo.example.com']);
  });

  it('VitalCVCredential declares did:web binding and EdDSA+ES256 algorithms', async () => {
    const res = await callOid4vci({ 'x-forwarded-host': 'demo.example.com' });
    const body = JSON.parse(await res.text());
    const cred = body.credential_configurations_supported.VitalCVCredential;
    expect(cred.cryptographic_binding_methods_supported).toContain('did:web');
    expect(cred.credential_signing_alg_values_supported).toEqual([
      'EdDSA',
      'ES256',
    ]);
  });
});
