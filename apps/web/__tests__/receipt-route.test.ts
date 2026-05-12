/**
 * /api/receipt/[npi] — end-to-end verifier flow.
 *
 * The load-bearing property of this endpoint is that an external
 * verifier with NO privileged access can:
 *
 *   1. fetch the receipt at /api/receipt/<npi>
 *   2. fetch the JWKS at /.well-known/jwks.json
 *   3. cryptographically validate the receipt against the JWKS
 *
 * The tests below execute exactly that flow in-process against mocked
 * backend data, plus pin the shape contract (ES256 + kid + replay
 * fields) and the `?format=download` content-disposition.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jwtVerify, createLocalJWKSet, decodeJwt, decodeProtectedHeader } from 'jose';

function buildPassport(overrides: Record<string, unknown> = {}) {
  return {
    entityId: 'entity-1',
    npi: '1346053246',
    identity: {
      displayName: 'Macie Miller',
      entityType: 'PERSON',
      specialty: 'PA-C',
      status: 'ACTIVE',
    },
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  process.env.VITALCV_ISSUER_ORIGIN = 'https://issuer.test.vitalcv.com';
  process.env.BACKEND_URL = 'http://backend.test';
});

async function callReceiptRoute(npi: string, search = '') {
  const mod = await import('../app/api/receipt/[npi]/route');
  const req = new Request(`http://localhost/api/receipt/${npi}${search}`) as never;
  return mod.GET(req, { params: Promise.resolve({ npi }) });
}

describe('/api/receipt/[npi]', () => {
  it('returns 400 on a non-10-digit NPI', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(buildPassport())));
    const res = await callReceiptRoute('not-a-npi');
    expect(res.status).toBe(400);
  });

  it('returns 502 when the upstream passport is malformed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ nope: true })));
    const res = await callReceiptRoute('1346053246');
    expect(res.status).toBe(502);
  });

  it('returns the backend status code when the upstream is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not found', { status: 404 })));
    const res = await callReceiptRoute('1346053246');
    expect(res.status).toBe(404);
  });

  it('returns 200 with application/jwt and the active kid on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(buildPassport())));
    const res = await callReceiptRoute('1346053246');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/jwt/);
    expect(res.headers.get('x-receipt-kid')).toBeTruthy();
    expect(res.headers.get('x-receipt-issuer')).toBe('did:web:issuer.test.vitalcv.com');

    const jwt = await res.text();
    const header = decodeProtectedHeader(jwt);
    expect(header.alg).toBe('ES256');
    expect(header.typ).toBe('vc+jwt');
    expect(header.kid).toBeTruthy();
  });

  it('produces a JWT whose payload carries the W3C VC 2.0 + VitalCV claim blocks', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(buildPassport())));
    const res = await callReceiptRoute('1346053246');
    const jwt = await res.text();
    const payload = decodeJwt(jwt) as Record<string, unknown> & {
      vc: Record<string, unknown>;
      vcv: Record<string, unknown>;
    };

    expect(payload.iss).toBe('did:web:issuer.test.vitalcv.com');
    expect(payload.sub).toBe('npi:1346053246');
    expect(typeof payload.jti).toBe('string');
    expect((payload.jti as string).startsWith('receipt:')).toBe(true);

    // VC 2.0
    expect(payload.vc).toMatchObject({
      type: ['VerifiableCredential', 'VitalCVTrustReceipt'],
      issuer: 'did:web:issuer.test.vitalcv.com',
    });

    // VitalCV claim block with replay identity
    expect(payload.vcv.replay).toMatchObject({
      lineageKey: 'lin_v1_aaaabbbbccccdddd',
      runId: 'run_v1_1111222233334444',
      schemeVersion: 'v1',
    });
    expect(payload.vcv.checkedAt).toBe('2026-04-01T15:00:00.000Z');
    expect(payload.vcv.jwksUri).toBe('https://issuer.test.vitalcv.com/.well-known/jwks.json');
    expect(payload.vcv.didDocumentUri).toBe('https://issuer.test.vitalcv.com/.well-known/did.json');
  });

  it('produces a deterministic jti derived from replay.runId', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => jsonResponse(buildPassport())));
    const a = decodeJwt(await (await callReceiptRoute('1346053246')).text()) as { jti: string };
    const b = decodeJwt(await (await callReceiptRoute('1346053246')).text()) as { jti: string };
    expect(a.jti).toBe('receipt:run_v1_1111222233334444');
    expect(a.jti).toBe(b.jti);
  });

  it('pins iat to lastCheckedAt seconds so the payload is stable across re-issuance', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => jsonResponse(buildPassport())));
    const a = decodeJwt(await (await callReceiptRoute('1346053246')).text()) as { iat: number; exp: number };
    const b = decodeJwt(await (await callReceiptRoute('1346053246')).text()) as { iat: number; exp: number };
    expect(a.iat).toBe(Math.floor(new Date('2026-04-01T15:00:00.000Z').getTime() / 1000));
    expect(a.iat).toBe(b.iat);
    expect(a.exp - a.iat).toBe(90 * 24 * 60 * 60);
  });

  it('end-to-end: an external verifier can validate the receipt against the published JWKS', async () => {
    // 1. Receipt
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(buildPassport())));
    const receiptRes = await callReceiptRoute('1346053246');
    const jwt = await receiptRes.text();

    // 2. JWKS (same handler the well-known route exposes)
    const jwksMod = await import('../app/.well-known/jwks.json/route');
    const jwksRes = await jwksMod.GET();
    const jwks = (await jwksRes.json()) as { keys: Array<Record<string, unknown>> };

    // 3. Verifier flow — validate signature against the JWKS
    const jwkSet = createLocalJWKSet(jwks as never);
    const verified = await jwtVerify(jwt, jwkSet, { algorithms: ['ES256'] });
    expect(verified.payload.iss).toBe('did:web:issuer.test.vitalcv.com');
    expect(verified.payload.sub).toBe('npi:1346053246');
    expect(verified.protectedHeader.alg).toBe('ES256');
    expect(verified.protectedHeader.kid).toBe(jwks.keys[0].kid);
  });

  it('?format=download adds Content-Disposition: attachment', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(buildPassport())));
    const res = await callReceiptRoute('1346053246', '?format=download');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="vitalcv-receipt-1346053246\.jwt"/);
  });

  it('omits the replay block gracefully when the backend response has no replay field', async () => {
    const noReplay = buildPassport({ replay: undefined });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(noReplay)));
    const res = await callReceiptRoute('1346053246');
    expect(res.status).toBe(200);
    const payload = decodeJwt(await res.text()) as { vcv: Record<string, unknown>; jti: string };
    expect(payload.vcv.replay).toBeNull();
    // jti falls back to npi-derived form
    expect(payload.jti).toBe('receipt:npi:1346053246');
  });
});
