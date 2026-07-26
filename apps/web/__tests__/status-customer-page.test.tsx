/**
 * status-customer-page.test.tsx — the /status split (audit 5.2).
 * /status is the plain-language customer summary; the operator console moved
 * to /status/technical. Pins: light shell, real-check framing, honest empty
 * incidents, links out, and NO raw camelCase compliance flags here (those stay
 * pinned on the technical page by status-page-compliance-evidence).
 */
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/lib/trust/register', () => ({
  getTrustRegisterSnapshot: async () => ({
    issuerDid: 'did:web:vitalcv.com',
    jwksUri: '/.well-known/jwks.json',
    didDocUri: '/.well-known/did.json',
    signingKeyId: 'k1',
    keyAlgorithm: 'ES256',
    doctrineVersion: '1.0',
    environment: 'test',
    proofTiers: [],
    replaySurvivable: true,
    lastVerifiedAt: 1,
    sources: [
      { sourceId: 'nppes_identity', displayName: 'NPPES Identity', lifecycle: 'active', lastCheckedAt: null },
      { sourceId: 'oig_exclusions', displayName: 'OIG Exclusions', lifecycle: 'partial', lastCheckedAt: null },
      { sourceId: 'state_license', displayName: 'State License', lifecycle: 'planned', lastCheckedAt: null },
    ],
    verifierEndpoints: [],
  }),
}));

vi.mock('@/lib/deployInfo', () => ({
  getVersionInfo: () => ({ commitShort: 'abc1234' }),
}));

let html = '';

beforeAll(async () => {
  // The backend probe fetch fails in vitest → the page must degrade honestly.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no network in tests')));
  const { default: StatusPage } = await import('@/app/status/page');
  html = renderToStaticMarkup(await (StatusPage as () => Promise<React.ReactElement>)());
});

describe('/status — customer summary', () => {
  it('renders the light plain-language page with real-check framing', () => {
    expect(html).toContain('mz-paper');
    expect(html).toContain('Is VitalCV up?');
    expect(html).toContain('checked when you loaded this page');
    expect(html).toContain('build abc1234');
  });

  it('degrades the API probe honestly when the backend is unreachable', () => {
    expect(html).toContain('Not responding right now');
  });

  it('shows source lanes as availability, and claims no uptime figures', () => {
    expect(html).toContain('NPPES Identity');
    expect(html).toContain('Available');
    expect(html).toContain('Access required');
    expect(html).toContain('does not publish uptime figures it has not measured');
  });

  it('has an honest empty incident feed and links out', () => {
    expect(html).toContain('No public incident feed is published yet');
    expect(html).toContain('href="/status/technical"');
    expect(html).toContain('href="/trust"');
    expect(html).toContain('href="/api/version"');
  });

  it('carries NO raw compliance flags (those live on the technical page)', () => {
    for (const raw of ['redactionLive:', 'retentionEnforced:', 'allAdaptersLive:', 'foundation shape']) {
      expect(html).not.toContain(raw);
    }
  });
});
