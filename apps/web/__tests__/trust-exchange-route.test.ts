/**
 * Wave 800 — verify-route federation boundary (Codex SAFE follow-up)
 * ──────────────────────────────────────────────────────────────────────────
 * Regression for the finding that the verify route authorized the verifier but
 * not the envelope's ISSUER. A validly-signed envelope is not sufficient — the
 * issuer must be an authorized federation issuer before any trust is derived.
 */
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/exchange/verify/route';
import { buildEvidenceExchange } from '../lib/exchange/exchange';
import { exchangeSecret } from '../lib/exchange/config';
import { passportToEvidenceCollection } from '../lib/evidence/passport-to-evidence';
import { buildDemoPassport } from '../lib/demo/demo-passport';

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
