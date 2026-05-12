/**
 * Wave 9 — four well-known surfaces pinned at RFC-correct paths.
 *
 *   /.well-known/jwks.json                (RFC 8615 + RFC 7517)
 *   /.well-known/did.json                 (W3C DID Core, did:web method)
 *   /.well-known/openid-credential-issuer (OID4VCI)
 *   /.well-known/trust-register           (VitalCV institutional manifest)
 *
 * The tests pin:
 *   - HTTP 200 + the canonical content-type for each surface
 *   - RFC-valid shape (top-level required fields per spec)
 *   - Cross-surface coherence: same DID, same kid, same JWKS URI
 *
 * Cross-surface coherence is the load-bearing invariant — any change
 * that lets the four surfaces disagree on issuer identity breaks
 * external verifier resolution.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  process.env.VITALCV_ISSUER_ORIGIN = 'https://issuer.test.vitalcv.com';
  process.env.VITALCV_RUNTIME_CHANNEL = 'staging';
});

describe('/.well-known/jwks.json (root, RFC-correct)', () => {
  it('returns 200 with application/jwk-set+json and a `keys` array', async () => {
    const mod = await import('../app/.well-known/jwks.json/route');
    const res = await mod.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/jwk-set\+json/);
    const body = await res.json();
    expect(Array.isArray(body.keys)).toBe(true);
    expect(body.keys.length).toBeGreaterThan(0);
    const key = body.keys[0];
    expect(key.kty).toBeDefined();
    expect(key.alg).toBe('ES256');
    expect(key.use).toBe('sig');
    expect(typeof key.kid).toBe('string');
    expect(key.kid.length).toBeGreaterThan(0);
    // Private component must NOT be present.
    expect(key.d).toBeUndefined();
  });
});

describe('/.well-known/did.json (W3C DID Core, did:web)', () => {
  it('returns 200 with application/did+json and a valid DID document', async () => {
    const mod = await import('../app/.well-known/did.json/route');
    const res = await mod.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/did\+json/);

    const doc = await res.json();
    expect(Array.isArray(doc['@context'])).toBe(true);
    expect(doc['@context']).toContain('https://www.w3.org/ns/did/v1');
    expect(typeof doc.id).toBe('string');
    expect(doc.id.startsWith('did:web:')).toBe(true);
    expect(Array.isArray(doc.verificationMethod)).toBe(true);
    expect(doc.verificationMethod.length).toBeGreaterThan(0);

    const vm = doc.verificationMethod[0];
    expect(vm.id.startsWith(doc.id + '#')).toBe(true);
    expect(vm.type).toBe('JsonWebKey2020');
    expect(vm.controller).toBe(doc.id);
    expect(vm.publicKeyJwk).toBeDefined();
    expect(vm.publicKeyJwk.d).toBeUndefined();

    expect(doc.assertionMethod).toContain(vm.id);
    expect(doc.authentication).toContain(vm.id);

    // Sibling well-known endpoints discoverable from the document.
    const services = doc.service as Array<{ id: string; type: string; serviceEndpoint: string }>;
    expect(services.some((s) => s.type === 'JsonWebKeySet')).toBe(true);
    expect(services.some((s) => s.type === 'OID4VCIIssuer')).toBe(true);
    expect(services.some((s) => s.type === 'VitalCVTrustRegister')).toBe(true);
  });
});

describe('/.well-known/openid-credential-issuer (OID4VCI)', () => {
  it('returns 200 with application/json and minimum required fields', async () => {
    const mod = await import('../app/.well-known/openid-credential-issuer/route');
    const res = await mod.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);

    const meta = await res.json();
    expect(typeof meta.credential_issuer).toBe('string');
    expect(typeof meta.credential_endpoint).toBe('string');
    expect(typeof meta.jwks_uri).toBe('string');
    expect(meta.jwks_uri.endsWith('/.well-known/jwks.json')).toBe(true);

    // draft-13+ shape
    expect(meta.credential_configurations_supported).toBeDefined();
    expect(typeof meta.credential_configurations_supported).toBe('object');

    // draft-11 back-compat shape
    expect(Array.isArray(meta.credentials_supported)).toBe(true);
    expect(meta.credentials_supported.length).toBeGreaterThan(0);

    // Display block carries an issuer name.
    expect(Array.isArray(meta.display)).toBe(true);
    expect(meta.display[0].name).toBe('VitalCV');
  });
});

describe('/.well-known/trust-register (VitalCV manifest)', () => {
  it('returns 200 with application/json and schema_version pinned', async () => {
    const mod = await import('../app/.well-known/trust-register/route');
    const res = await mod.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);

    const manifest = await res.json();
    expect(manifest.schema_version).toBe(1);
    expect(manifest.issuer.did.startsWith('did:web:')).toBe(true);
    expect(typeof manifest.issuer.origin).toBe('string');

    expect(typeof manifest.signing.active_kid).toBe('string');
    expect(manifest.signing.algorithm).toBe('ES256');
    expect(manifest.signing.jwks_uri).toMatch(/\/\.well-known\/jwks\.json$/);
    expect(manifest.signing.did_document_uri).toMatch(/\/\.well-known\/did\.json$/);

    expect(manifest.runtime.channel).toBe('staging');
    expect(typeof manifest.runtime.deploy_commit).toBe('string');
    expect(typeof manifest.runtime.published_at).toBe('string');

    expect(Array.isArray(manifest.launch_spine)).toBe(true);
    expect(manifest.launch_spine.length).toBe(4);
    const ids = manifest.launch_spine.map((s: { id: string }) => s.id).sort();
    expect(ids).toEqual(['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC', 'STATE_BOARD']);

    expect(Array.isArray(manifest.credentials)).toBe(true);
    expect(manifest.credentials.length).toBeGreaterThan(0);

    // Disclaimers must be present and non-empty.
    expect(Array.isArray(manifest.disclaimers)).toBe(true);
    expect(manifest.disclaimers.length).toBeGreaterThan(0);
  });
});

describe('cross-surface coherence (load-bearing institutional invariant)', () => {
  it('all four surfaces agree on issuer DID, JWKS URI, and kid', async () => {
    const [jwks, did, oidc, trust] = await Promise.all([
      import('../app/.well-known/jwks.json/route').then((m) => m.GET()).then((r) => r.json()),
      import('../app/.well-known/did.json/route').then((m) => m.GET()).then((r) => r.json()),
      import('../app/.well-known/openid-credential-issuer/route').then((m) => m.GET()).then((r) => r.json()),
      import('../app/.well-known/trust-register/route').then((m) => m.GET()).then((r) => r.json()),
    ]);

    const kid = jwks.keys[0].kid;
    expect(typeof kid).toBe('string');

    // DID document's verification-method id includes the same kid.
    const vm = did.verificationMethod[0];
    expect(vm.id).toBe(`${did.id}#${kid}`);
    expect(vm.publicKeyJwk.kid).toBe(kid);

    // OID4VCI metadata points at the same JWKS.
    expect(oidc.jwks_uri).toBe(trust.signing.jwks_uri);

    // Trust register agrees on DID + kid.
    expect(trust.issuer.did).toBe(did.id);
    expect(trust.signing.active_kid).toBe(kid);
    expect(trust.signing.did_document_uri).toBe(`${trust.issuer.origin}/.well-known/did.json`);

    // No private key leakage in any surface.
    expect(jwks.keys[0].d).toBeUndefined();
    expect(did.verificationMethod[0].publicKeyJwk.d).toBeUndefined();
  });
});
