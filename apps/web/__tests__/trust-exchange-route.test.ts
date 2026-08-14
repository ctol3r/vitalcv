/**
 * Wave 800 — verify-route federation boundary (Codex SAFE follow-up)
 * ──────────────────────────────────────────────────────────────────────────
 * Regression for the finding that the verify route authorized the verifier but
 * not the envelope's ISSUER. A validly-signed envelope is not sufficient — the
 * issuer must be an authorized federation issuer before any trust is derived.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/exchange/verify/route';
import { POST as issue } from '../app/api/exchange/issue/route';
import { buildEvidenceExchange } from '../lib/exchange/exchange';
import { exchangeSecret } from '../lib/exchange/config';
import { passportToEvidenceCollection } from '../lib/evidence/passport-to-evidence';
import { buildDemoPassport } from '../lib/demo/demo-passport';

const { resolveMock } = vi.hoisted(() => ({ resolveMock: vi.fn() }));
vi.mock('@/lib/trust/passport-runtime', () => ({
  resolvePassportRuntimePassport: resolveMock,
}));

const ORIGINAL_ISSUER = process.env.TRUST_EXCHANGE_ISSUER;
const ORIGINAL_ISSUER_SECRET = process.env.TRUST_EXCHANGE_ISSUER_SECRET;

function makeExchange(issuer: string) {
  const collection = passportToEvidenceCollection(buildDemoPassport());
  // Signed with the same dev secret the route uses (non-production).
  return buildEvidenceExchange({ issuer, collection, secret: exchangeSecret(), issuedAt: '2026-06-20T00:00:00.000Z' });
}

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/exchange/verify', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function issuePost(body: unknown, authorization?: string) {
  return issue(
    new NextRequest('http://localhost/api/exchange/issue', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'content-type': 'application/json',
        ...(authorization ? { authorization } : {}),
      },
    }),
  );
}

describe('POST /api/exchange/verify — issuer federation boundary', () => {
  it('rejects a validly-signed envelope from a non-member issuer (no trust derived)', async () => {
    const exchange = makeExchange('org-unknown');
    const res = await post({ exchange, verifier: 'org-coastal-staffing' });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('issuer_not_authorized');
  });

  it('rejects a verify-only member acting as issuer', async () => {
    // org-coastal-staffing is a verifier-only federation member.
    const exchange = makeExchange('org-coastal-staffing');
    const res = await post({ exchange, verifier: 'org-coastal-staffing' });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('issuer_not_authorized');
  });

  it('accepts an authorized issuer + verifier and re-derives trust (not transferred)', async () => {
    const exchange = makeExchange('org-mercy-health');
    const res = await post({ exchange, verifier: 'org-coastal-staffing' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.signatureValid).toBe(true);
    expect(json.trustTransferred).toBe(false);
    expect(json.trust).not.toBeNull();
  });

  it('still rejects an unauthorized verifier before reaching issuer checks', async () => {
    const exchange = makeExchange('org-mercy-health');
    const res = await post({ exchange, verifier: 'org-not-a-member' });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('verifier_not_authorized');
  });
});

describe('POST /api/exchange/issue — machine and issuer binding boundary', () => {
  beforeEach(() => {
    process.env.TRUST_EXCHANGE_ISSUER = 'org-mercy-health';
    process.env.TRUST_EXCHANGE_ISSUER_SECRET = 'test-machine-credential';
    resolveMock.mockReset();
    resolveMock.mockResolvedValue(buildDemoPassport());
  });

  afterEach(() => {
    if (ORIGINAL_ISSUER === undefined) delete process.env.TRUST_EXCHANGE_ISSUER;
    else process.env.TRUST_EXCHANGE_ISSUER = ORIGINAL_ISSUER;
    if (ORIGINAL_ISSUER_SECRET === undefined) delete process.env.TRUST_EXCHANGE_ISSUER_SECRET;
    else process.env.TRUST_EXCHANGE_ISSUER_SECRET = ORIGINAL_ISSUER_SECRET;
  });

  it('rejects an anonymous issuance request before reading evidence', async () => {
    const res = await issuePost({ entityId: '1234567890', issuer: 'org-mercy-health' });

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('issuer_unauthorized');
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('fails closed when the server issuer configuration is absent', async () => {
    delete process.env.TRUST_EXCHANGE_ISSUER;
    delete process.env.TRUST_EXCHANGE_ISSUER_SECRET;

    const res = await issuePost({ entityId: '1234567890', issuer: 'org-mercy-health' });

    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('issuer_unavailable');
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('rejects a wrong machine credential before reading evidence', async () => {
    const res = await issuePost(
      { entityId: '1234567890', issuer: 'org-mercy-health' },
      'Bearer wrong-machine-credential',
    );

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('issuer_unauthorized');
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('rejects a caller-selected issuer that differs from the server-bound issuer', async () => {
    const res = await issuePost(
      { entityId: '1234567890', issuer: 'org-vitalcv-network' },
      'Bearer test-machine-credential',
    );

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('issuer_not_authorized');
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('rejects a server-bound issuer without the federation issuer role before reading evidence', async () => {
    process.env.TRUST_EXCHANGE_ISSUER = 'org-coastal-staffing';

    const res = await issuePost(
      { entityId: '1234567890', issuer: 'org-coastal-staffing' },
      'Bearer test-machine-credential',
    );

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('issuer_not_authorized');
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('issues with a valid machine credential only for the server-bound issuer', async () => {
    const res = await issuePost(
      { entityId: '1234567890', issuer: 'org-mercy-health', issuedAt: '2026-06-20T00:00:00.000Z' },
      'Bearer test-machine-credential',
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.json()).issuer).toBe('org-mercy-health');
    expect(resolveMock).toHaveBeenCalledWith('1234567890');
  });
});
