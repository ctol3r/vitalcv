/**
 * trust-center.test.tsx — /trust becomes a human Trust Center; the technical
 * register moves to /trust/technical with the required notice; and the register
 * no longer fabricates a fresh checkedAt/runId per render.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { TrustRegisterSnapshot } from '@/lib/trust/register';
import { TrustStateRegister } from '@/components/trust/TrustStateRegister';

const BASE: TrustRegisterSnapshot = {
  issuerDid: 'did:web:vitalcv.com',
  jwksUri: '/.well-known/jwks.json',
  didDocUri: '/.well-known/did.json',
  signingKeyId: 'key-1',
  keyAlgorithm: 'ES256',
  doctrineVersion: '1.0',
  environment: 'pilot',
  proofTiers: ['T1', 'T2', 'T3', 'T4'],
  replaySurvivable: true,
  lastVerifiedAt: 1_700_000_000_000,
  sources: [
    { sourceId: 'nppes_identity', displayName: 'NPPES Identity', lifecycle: 'active', lastCheckedAt: null },
    { sourceId: 'oig_exclusions', displayName: 'OIG Exclusions', lifecycle: 'partial', lastCheckedAt: null },
    { sourceId: 'state_license', displayName: 'State License', lifecycle: 'planned', lastCheckedAt: null },
  ],
  verifierEndpoints: [{ path: '/.well-known/jwks.json', description: 'keys', requiresAuth: false }],
};

vi.mock('@/lib/trust/register', async (orig) => {
  const actual = await orig<typeof import('@/lib/trust/register')>();
  return { ...actual, getTrustRegisterSnapshot: async () => BASE };
});

describe('TrustStateRegister — no fabricated freshness (audit #5)', () => {
  it('renders the SAME checkedAt regardless of the live snapshot time', () => {
    const a = renderToStaticMarkup(<TrustStateRegister snapshot={{ ...BASE, lastVerifiedAt: 1 }} />);
    const b = renderToStaticMarkup(<TrustStateRegister snapshot={{ ...BASE, lastVerifiedAt: 9_999_999_999_999 }} />);
    const ts = (html: string) => html.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC/)?.[0];
    // The example instant is fixed; two different live times → identical render.
    expect(ts(a)).toBeTruthy();
    expect(ts(a)).toBe(ts(b));
  });
});

describe('/trust — human Trust Center', () => {
  it('leads with the human sections, not the technical register', async () => {
    const { default: TrustCenterPage } = await import('@/app/trust/page');
    const html = renderToStaticMarkup(await (TrustCenterPage as () => Promise<React.ReactElement>)());
    expect(html).toContain('Trust Center');
    expect(html).toContain('does not decide');
    expect(html).toContain('The sources VitalCV reads');
    expect(html).toContain('What each evidence state means');
    // The evidence-state grammar via StateChip.
    expect(html).toContain('Source-backed');
    expect(html).toContain('Access required');
    expect(html).toContain('Employer decision');
    // Controls + security + links out.
    expect(html).toContain('The controls you keep');
    expect(html).toContain('security@vitalcv.com');
    expect(html).toContain('href="/trust/technical"');
    expect(html).toContain('href="/.well-known/trust-register"');
    // Never the bare status word.
    expect(/>\s*Verified\s*</.test(html)).toBe(false);
  });

  it('describes source attribution without promising a correction workflow', async () => {
    const { default: TrustCenterPage } = await import('@/app/trust/page');
    const html = renderToStaticMarkup(await (TrustCenterPage as () => Promise<React.ReactElement>)());

    expect(html).toContain('Source records stay attributable');
    expect(html).toContain('Source-backed values retain their source and read time.');
    expect(html).toContain('You can add self-attested information to your profile; VitalCV does not silently replace source records.');
    expect(html).not.toContain('Corrections have a path');
    expect(html).not.toContain('flag it and attach supporting evidence');
  });
});

describe('/trust/technical — moved register with notice', () => {
  it('renders the required technical-reference notice + illustration label', async () => {
    const { default: TrustTechnicalPage } = await import('@/app/trust/technical/page');
    const html = renderToStaticMarkup(await (TrustTechnicalPage as () => Promise<React.ReactElement>)());
    expect(html).toContain('This page explains VitalCV');
    expect(html).toContain('It is not a clinician record');
    expect(html).toContain('does not represent a completed credentialing decision');
    expect(html).toContain('architectural illustration');
    expect(html).toContain('/.well-known/trust-register');
    expect(html).toContain('href="/trust"');
  });
});
