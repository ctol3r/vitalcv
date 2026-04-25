/**
 * Wave 4 — TrustContainerPanel verifier UX tests.
 *
 * Covers:
 *   - issued / failed / not_issued / missing-metadata states
 *   - mock-dev explicit label
 *   - limitation-note rendering (and preservation of partial state)
 *   - overclaim-safe copy lines always present
 *   - banned-string regex does not match any rendered state
 */

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  TrustContainerPanel,
  type TrustContainerManifestView,
} from '../components/trust/TrustContainerPanel';

const BANNED_STRINGS = [
  'blockchain-anchored',
  'blockchain verified',
  'zero-trust ledger',
  'zero-knowledge proof',
  'hire instantly',
  'wallet ready',
  'fully verified',
  'guaranteed',
  'legally accepted',
  'risk transferred',
  'complete credentialing',
  'instant hire',
  'on-chain proof',
  'ledger',
] as const;

function assertNoBannedStrings(html: string): void {
  const lower = html.toLowerCase();
  for (const phrase of BANNED_STRINGS) {
    expect(lower).not.toContain(phrase);
  }
}

const REQUIRED_DISCLAIMERS = [
  'This container records the evidence packet’s credential envelope and artifact hash.',
  'It does not replace primary source verification.',
  'It does not upgrade partial evidence to decision-grade.',
  'Limitations shown here remain controlling.',
] as const;

function buildIssuedEntry(
  overrides: Partial<TrustContainerManifestView> = {},
): TrustContainerManifestView {
  return {
    status: 'issued',
    trustContainerId: 'mock_vc_1234567890abcdef',
    credentialEnvelopeId: 'envelope_abcdef123456',
    provider: 'mock',
    label: 'Mock/dev credential container',
    environment: 'mock-dev',
    issuedAt: '2026-04-24T00:00:00.000Z',
    schemaVersion: '1.0.0',
    artifactHash: 'a'.repeat(64),
    auditHash: 'b'.repeat(64),
    proofTier: 'DECISION_GRADE',
    proofStatus: 'DECISION_GRADE',
    limitationNotes: [],
    mock: true,
    ...overrides,
  };
}

describe('TrustContainerPanel', () => {
  it('renders the issued state with provider, tier, mock label, and safe references', () => {
    const html = renderToStaticMarkup(<TrustContainerPanel entry={buildIssuedEntry()} />);
    expect(html).toContain('Credential container: issued');
    expect(html).toContain('Mock/dev credential container');
    expect(html).toContain('data-state="issued"');
    expect(html).toContain('data-mock="true"');
    expect(html).toContain('mock'); // provider
    expect(html).toContain('DECISION_GRADE');
    expect(html).toContain('Container reference');
    expect(html).toContain('Credential envelope');
    expect(html).toContain('Artifact binding');
    expect(html).toContain('Audit binding');
    expect(html).toContain('Recorded in manifest');
    expect(html).not.toContain('mock_vc_1234567890abcdef');
    expect(html).not.toContain('envelope_abcdef123456');
    expect(html).not.toContain('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(html).not.toContain('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    for (const line of REQUIRED_DISCLAIMERS) expect(html).toContain(line);
    assertNoBannedStrings(html);
  });

  it('renders the failed state with a redacted skip reason and no container id leak', () => {
    const entry: TrustContainerManifestView = {
      ...buildIssuedEntry(),
      status: 'failed',
      trustContainerId: null,
      credentialEnvelopeId: null,
      artifactHash: null,
      auditHash: null,
      proofTier: null,
      proofStatus: null,
      label: 'Credential container: issuance failed',
      skipReason: 'provider throw: on-chain proof outage api_key=sk_live_secret123',
    };
    const html = renderToStaticMarkup(<TrustContainerPanel entry={entry} />);
    expect(html).toContain('Credential container: issuance failed');
    expect(html).toContain('provider throw: [unsupported claim] outage api_key=[redacted]');
    expect(html).not.toContain('sk_live_secret123');
    expect(html).toContain('data-state="failed"');
    expect(html).not.toContain('Container reference');
    for (const line of REQUIRED_DISCLAIMERS) expect(html).toContain(line);
    assertNoBannedStrings(html);
  });

  it('renders the skipped state with its skip reason', () => {
    const entry: TrustContainerManifestView = {
      status: 'not_issued',
      trustContainerId: null,
      credentialEnvelopeId: null,
      provider: null,
      label: 'Credential container: not issued',
      environment: null,
      issuedAt: null,
      schemaVersion: '1.0.0',
      artifactHash: null,
      auditHash: null,
      proofTier: null,
      proofStatus: null,
      limitationNotes: [],
      mock: false,
      skipReason: 'container disabled in this environment',
    };
    const html = renderToStaticMarkup(<TrustContainerPanel entry={entry} />);
    expect(html).toContain('Credential container: skipped');
    expect(html).toContain('container disabled in this environment');
    expect(html).toContain('data-state="not_issued"');
    expect(html).toContain('data-mock="false"');
    expect(html).not.toContain('Mock/dev credential container');
    assertNoBannedStrings(html);
  });

  it('falls back cleanly when the entry is missing', () => {
    const html = renderToStaticMarkup(<TrustContainerPanel entry={null} />);
    expect(html).toContain('Credential container: not available');
    expect(html).toContain('Primary source verification remains the authoritative evidence.');
    expect(html).toContain('data-state="missing"');
    assertNoBannedStrings(html);
  });

  it('renders limitation notes and keeps limited proof partial', () => {
    const entry = buildIssuedEntry({
      proofTier: 'DECISION_GRADE',
      proofStatus: 'DECISION_GRADE',
      limitationNotes: [
        'Identity not strictly verified',
        'Institutional access required',
        'Do not claim on-chain proof or guaranteed acceptance.',
      ],
    });
    const html = renderToStaticMarkup(<TrustContainerPanel entry={entry} />);
    expect(html).toContain('Limitations');
    expect(html).toContain('Identity not strictly verified');
    expect(html).toContain('Institutional access required');
    expect(html).toContain('Do not claim [unsupported claim] or [unsupported claim] acceptance.');
    // Limited proof stays partial even if upstream container metadata drifts.
    expect(html).not.toContain('>DECISION_GRADE<');
    expect(html).toContain('>PARTIAL<');
    for (const line of REQUIRED_DISCLAIMERS) expect(html).toContain(line);
    assertNoBannedStrings(html);
  });

  it('includes the mock/dev disclaimer only for mock-dev containers', () => {
    const mockEntry = buildIssuedEntry();
    const liveEntry = buildIssuedEntry({
      provider: 'dock',
      environment: 'dock-scaffold',
      label: 'Dock scaffold credential container',
      mock: false,
    });
    const mockHtml = renderToStaticMarkup(<TrustContainerPanel entry={mockEntry} />);
    const liveHtml = renderToStaticMarkup(<TrustContainerPanel entry={liveEntry} />);
    expect(mockHtml).toContain('Mock/dev containers are not production credentials.');
    expect(liveHtml).not.toContain('Mock/dev containers are not production credentials.');
    expect(liveHtml).toContain('Credential container: issued');
    assertNoBannedStrings(mockHtml);
    assertNoBannedStrings(liveHtml);
  });

  it('never renders any banned overclaim string across any state permutation', () => {
    const permutations: Array<TrustContainerManifestView | null> = [
      null,
      buildIssuedEntry(),
      buildIssuedEntry({ provider: 'dock', environment: 'dock-scaffold', mock: false }),
      buildIssuedEntry({
        proofTier: 'PARTIAL',
        proofStatus: 'PARTIAL',
        limitationNotes: ['Identity not strictly verified'],
      }),
      {
        ...buildIssuedEntry(),
        status: 'failed',
        trustContainerId: null,
        credentialEnvelopeId: null,
        proofTier: null,
        proofStatus: null,
        label: 'Credential container: issuance failed',
        skipReason: 'provider throw',
      },
      {
        status: 'not_issued',
        trustContainerId: null,
        credentialEnvelopeId: null,
        provider: null,
        label: 'Credential container: not issued',
        environment: null,
        issuedAt: null,
        schemaVersion: '1.0.0',
        artifactHash: null,
        auditHash: null,
        proofTier: null,
        proofStatus: null,
        limitationNotes: [],
        mock: false,
        skipReason: 'policy skip',
      },
    ];
    for (const entry of permutations) {
      const html = renderToStaticMarkup(<TrustContainerPanel entry={entry} />);
      assertNoBannedStrings(html);
    }
  });

  it('redacts secret-looking values from displayed limitation notes', () => {
    const html = renderToStaticMarkup(<TrustContainerPanel entry={buildIssuedEntry({
      proofTier: 'PARTIAL',
      proofStatus: 'PARTIAL',
      limitationNotes: ['provider returned private_key=pk_live_secret123 and hash abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef'],
    })} />);

    expect(html).toContain('private_key=[redacted]');
    expect(html).toContain('[redacted reference]');
    expect(html).not.toContain('pk_live_secret123');
    expect(html).not.toContain('abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef');
  });
});
