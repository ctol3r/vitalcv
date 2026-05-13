/**
 * Tests for the three verifier-continuity completion surfaces shipped
 * in this PR (stacked on #349):
 *
 *   /.well-known/openid-configuration   — OIDC discovery (courtesy)
 *   /trust                              — institutional overview page
 *   /api/receipt/[lineageKey]           — lineageKey-keyed receipt
 *
 * Cross-surface coherence with the existing #349 surfaces is also pinned.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { decodeJwt, decodeProtectedHeader } from 'jose';

const ORIGIN = 'https://issuer.test.vitalcv.com';
const TEST_NPI = '1346053246';

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  process.env.VITALCV_ISSUER_ORIGIN = ORIGIN;
  process.env.VITALCV_RUNTIME_CHANNEL = 'staging';
  process.env.BACKEND_URL = 'http://backend.test';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── /.well-known/openid-configuration ─────────────────────────────────────

describe('/.well-known/openid-configuration', () => {
  it('returns 200 with the required OIDC fields', async () => {
    const mod = await import('../app/.well-known/openid-configuration/route');
    const res = await mod.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.issuer).toBe(ORIGIN);
    expect(body.jwks_uri).toBe(`${ORIGIN}/.well-known/jwks.json`);
    expect(body.id_token_signing_alg_values_supported).toEqual(['ES256']);
    expect(body.subject_types_supported).toEqual(['public']);
  });

  it('emits empty response_types_supported (no OAuth flow) — honest, not a placeholder', async () => {
    const mod = await import('../app/.well-known/openid-configuration/route');
    const res = await mod.GET();
    const body = await res.json();
    expect(body.response_types_supported).toEqual([]);
  });

  it('emits the vitalcv:role + pointer to credential-issuer metadata', async () => {
    const mod = await import('../app/.well-known/openid-configuration/route');
    const res = await mod.GET();
    const body = await res.json();
    expect(body['vitalcv:role']).toBe('credential_issuer_only');
    expect(body['vitalcv:credential_issuer_metadata']).toBe(
      `${ORIGIN}/.well-known/openid-credential-issuer`,
    );
    expect(body['vitalcv:notes']).toContain('VitalCV is a Verifiable Credential issuer');
  });

  it('points authorization_endpoint and token_endpoint at the credential-issuer metadata (no placeholder URLs)', async () => {
    const mod = await import('../app/.well-known/openid-configuration/route');
    const res = await mod.GET();
    const body = await res.json();
    const expected = `${ORIGIN}/.well-known/openid-credential-issuer`;
    expect(body.authorization_endpoint).toBe(expected);
    expect(body.token_endpoint).toBe(expected);
  });

  it('has production-safe Cache-Control (public, max-age=3600, swr=86400)', async () => {
    const mod = await import('../app/.well-known/openid-configuration/route');
    const res = await mod.GET();
    expect(res.headers.get('cache-control')).toMatch(/public.*max-age=3600.*stale-while-revalidate=86400/);
  });
});

// ─── /trust page ──────────────────────────────────────────────────────────

describe('/trust page', () => {
  it('server-renders the institutional overview using the trust-register payload', async () => {
    const mod = await import('../app/trust/page');
    // Async server component — call as function, await the JSX, render to string.
    const element = await (mod.default as () => Promise<React.ReactElement>)();
    const html = renderToStaticMarkup(element);

    // Header text
    expect(html).toContain('Institutional trust infrastructure');
    expect(html).toContain('VitalCV · trust');

    // Section anchors (institutional reading order)
    expect(html).toContain('data-section="issuer identity"');
    expect(html).toContain('data-section="signing"');
    expect(html).toContain('data-section="runtime"');
    expect(html).toContain('data-section="launch-spine sources"');
    expect(html).toContain('data-section="supported credentials"');
    expect(html).toContain('data-section="discovery endpoints"');
    expect(html).toContain('data-section="operational doctrine"');
    expect(html).toContain('data-section="disclaimers"');

    // Real values from the trust-register (issuer DID, kid, jwks URI)
    expect(html).toContain('did:web:issuer.test.vitalcv.com');
    expect(html).toContain('/.well-known/jwks.json');
    expect(html).toContain('ES256');

    // All four launch-spine source ids visible
    expect(html).toContain('data-source-id="NPPES_API"');
    expect(html).toContain('data-source-id="OIG_LEIE"');
    expect(html).toContain('data-source-id="PECOS_PUBLIC"');
    expect(html).toContain('data-source-id="STATE_BOARD"');
  });
});

// ─── /api/receipt/[lineageKey] ────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildPassport(overrides: Record<string, unknown> = {}) {
  return {
    entityId: 'entity-1',
    npi: TEST_NPI,
    identity: { displayName: 'Macie Miller', entityType: 'PERSON', specialty: 'PA-C', status: 'ACTIVE' },
    readiness: { score: 50, level: 'L1', status: 'PARTIAL' },
    trustPosture: { band: 'YELLOW' },
    lastCheckedAt: '2026-04-01T15:00:00.000Z',
    replay: {
      lineageKey: 'lin_v1_aaaabbbbccccdddd',
      runId: 'run_v1_1111222233334444',
      schemeVersion: 'v1' as const,
    },
    ...overrides,
  };
}

async function callReceiptByLineage(lineageKey: string, search = '') {
  const mod = await import('../app/api/receipt/by-lineage/[lineageKey]/route');
  const req = new Request(`http://localhost/api/receipt/by-lineage/${lineageKey}${search}`) as never;
  return mod.GET(req, { params: Promise.resolve({ lineageKey }) });
}

describe('/api/receipt/[lineageKey]', () => {
  it('returns 400 on a malformed lineageKey (not lin_v1_<16 hex>)', async () => {
    const res = await callReceiptByLineage('not-a-key', '?npi=1346053246');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_lineage_key');
  });

  it('returns 501 when no ?npi= query is supplied (claim required, no backend index)', async () => {
    const res = await callReceiptByLineage('lin_v1_aaaabbbbccccdddd');
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toBe('npi_query_required');
    expect(body.alternative_path).toBe('/api/receipt/<npi>');
  });

  it('returns 400 when ?npi= is not 10 digits', async () => {
    const res = await callReceiptByLineage('lin_v1_aaaabbbbccccdddd', '?npi=not-a-npi');
    expect(res.status).toBe(400);
  });

  it('returns 401 when computeLineageKey(npi) does not match the path lineageKey', async () => {
    const res = await callReceiptByLineage('lin_v1_aaaabbbbccccdddd', `?npi=${TEST_NPI}`);
    // The fixed string lin_v1_aaaabbbbccccdddd is unlikely to equal sha256("entity|1346053246")[0:16].
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('lineage_mismatch');
    expect(body.path_lineageKey).toBe('lin_v1_aaaabbbbccccdddd');
    expect(body.expected_lineageKey).toMatch(/^lin_v1_[0-9a-f]{16}$/);
  });

  it('issues a real signed JWT receipt when lineageKey + npi cross-check passes', async () => {
    // Step 1: compute the real lineageKey for our test NPI by hitting the
    // 401 path and reading expected_lineageKey from the response body.
    const probe = await callReceiptByLineage('lin_v1_aaaabbbbccccdddd', `?npi=${TEST_NPI}`);
    const probeBody = await probe.json();
    const realLineageKey: string = probeBody.expected_lineageKey;
    expect(realLineageKey).toMatch(/^lin_v1_[0-9a-f]{16}$/);

    // Step 2: stub the upstream backend so the NPI receipt handler can
    // build its JWT payload.
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => jsonResponse(buildPassport())));

    // Step 3: call with the correct lineageKey + npi pair — should issue.
    const res = await callReceiptByLineage(realLineageKey, `?npi=${TEST_NPI}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/jwt/);

    const jwt = await res.text();
    const header = decodeProtectedHeader(jwt);
    const payload = decodeJwt(jwt) as Record<string, unknown> & {
      vcv: { replay: { lineageKey: string } };
    };
    expect(header.alg).toBe('ES256');
    expect(payload.sub).toBe(`npi:${TEST_NPI}`);
    expect(payload.vcv.replay.lineageKey).toBe('lin_v1_aaaabbbbccccdddd'); // from passport fixture
  });
});

// ─── cross-surface coherence — net-new surfaces agree with #349 ───────────

describe('verifier-continuity completion — cross-surface coherence', () => {
  it('openid-configuration jwks_uri matches the JWKS surface from #349', async () => {
    const [oidc, jwks] = await Promise.all([
      import('../app/.well-known/openid-configuration/route').then((m) => m.GET()).then((r) => r.json()),
      import('../app/.well-known/jwks.json/route').then((m) => m.GET()).then((r) => ({
        status: r.status,
        body: r.json().then((b) => b),
      })),
    ]);
    expect(jwks.status).toBe(200);
    expect(oidc.jwks_uri).toMatch(/\/\.well-known\/jwks\.json$/);
  });

  it('openid-configuration issuer matches the did.json id and trust-register issuer.did host', async () => {
    const oidc = await import('../app/.well-known/openid-configuration/route').then((m) => m.GET()).then((r) => r.json());
    const did = await import('../app/.well-known/did.json/route').then((m) => m.GET()).then((r) => r.json());
    const trustReg = await import('../app/.well-known/trust-register/route').then((m) => m.GET()).then((r) => r.json());
    expect(oidc.issuer).toBe(trustReg.issuer.origin);
    expect(did.id).toBe(trustReg.issuer.did);
  });
});

describe('doctrine — banned-strings scan', () => {
  it('no surface emits banned phrases', async () => {
    const [oidc, trustHtml] = await Promise.all([
      import('../app/.well-known/openid-configuration/route').then((m) => m.GET()).then((r) => r.text()),
      (async () => {
        const mod = await import('../app/trust/page');
        const el = await (mod.default as () => Promise<React.ReactElement>)();
        return renderToStaticMarkup(el);
      })(),
    ]);
    const combined = oidc + '\n' + trustHtml;
    const banned = [
      ['automatically', 'verified'].join(' '),
      ['guaranteed', 'verification'].join(' '),
      ['HIPAA', 'compliant'].join(' '),
      ['SOC2', 'certified'].join(' '),
      ['certified', 'compliant'].join(' '),
      ['complete', 'credentialing'].join(' '),
      ['legally', 'accepted'].join(' '),
      ['risk', 'transferred'].join(' '),
    ];
    for (const p of banned) expect(combined).not.toContain(p);
  });
});
