/**
 * W4-PR248A — proof manifest view lockdown.
 *
 * Pins the truth-contract behavior of deriveProofManifestView and the
 * server-rendered ProofManifestPanel:
 *   - Missing manifest → ambiguity-visible verdict; banner shown.
 *   - Coverage lanes with non-OK status are flagged ambiguity-visible.
 *   - Aggregate verdict label never collapses to bare-word "Verified".
 *   - Banned strings (per CLAUDE.md) do not appear in derived view
 *     output or the rendered panel.
 */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { deriveProofManifestView } from '../lib/proof/proofManifestView';
import { ProofManifestPanel } from '../components/proof/ProofManifestPanel';

// Split-join sentinels so this file does not match itself via grep.
const BANNED = [
  ['automatically', 'verified'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['instant', 'credentialing'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['risk', 'transferred'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
  ['certified', 'compliant'].join(' '),
];

const FULL_MANIFEST = {
  manifestId: '11111111-2222-3333-4444-555555555555',
  schema: 'vitalcv.manifest.v1',
  generatedAt: '2026-05-11T00:00:00Z',
  subject: {
    npi: '1346053246',
    entityType: 'PA-C',
    credentialedName: 'Macie Miller',
  },
  readinessPosture: 'SOURCE-BACKED',
  proofAvailability: 'SOURCE-RECEIPTS',
  coverage: [
    {
      source: 'NPPES',
      laneType: 'identity',
      status: 'OK',
      checkedAt: '2026-05-10T00:00:00Z',
      observedAt: '2026-05-10T00:00:00Z',
      ttl: 3600000,
      errorClass: null,
    },
    {
      source: 'OIG',
      laneType: 'exclusion',
      status: 'STALE',
      checkedAt: '2026-04-01T00:00:00Z',
      observedAt: '2026-04-01T00:00:00Z',
      ttl: 3600000,
      errorClass: null,
    },
  ],
  claims: [{ id: 'c1' }, { id: 'c2' }],
  receipts: [{ receiptId: 'r1' }],
  limitations: [{ kind: 'stale-source', detail: 'OIG check is over 30 days old' }],
  freshnessSummary: {
    oldestCheck: '2026-04-01T00:00:00Z',
    newestCheck: '2026-05-10T00:00:00Z',
    staleLanes: 1,
  },
};

describe('W4-PR248A — deriveProofManifestView: missing / incomplete', () => {
  it('null input returns ambiguity-visible view', () => {
    const v = deriveProofManifestView(null);
    expect(v.manifestIncomplete).toBe(true);
    expect(v.aggregateVerdict).toBe('unknown');
    expect(v.coverage).toHaveLength(0);
  });

  it('non-object input returns ambiguity-visible view', () => {
    expect(deriveProofManifestView('not-a-manifest').manifestIncomplete).toBe(true);
    expect(deriveProofManifestView(42).aggregateVerdict).toBe('unknown');
  });

  it('manifest missing manifestId triggers incomplete flag', () => {
    const v = deriveProofManifestView({ ...FULL_MANIFEST, manifestId: undefined });
    expect(v.manifestIncomplete).toBe(true);
    expect(v.aggregateVerdict).toBe('unknown');
  });

  it('manifest missing generatedAt triggers incomplete flag', () => {
    const v = deriveProofManifestView({ ...FULL_MANIFEST, generatedAt: undefined });
    expect(v.manifestIncomplete).toBe(true);
  });

  it('manifest missing subject triggers incomplete flag', () => {
    const v = deriveProofManifestView({ ...FULL_MANIFEST, subject: undefined });
    expect(v.manifestIncomplete).toBe(true);
  });

  it('view object is frozen', () => {
    const v = deriveProofManifestView(FULL_MANIFEST);
    expect(Object.isFrozen(v)).toBe(true);
  });

  it('coverage array is frozen', () => {
    const v = deriveProofManifestView(FULL_MANIFEST);
    expect(Object.isFrozen(v.coverage)).toBe(true);
  });
});

describe('W4-PR248A — deriveProofManifestView: coverage lane ambiguity', () => {
  it('OK lane is NOT ambiguity-visible', () => {
    const v = deriveProofManifestView(FULL_MANIFEST);
    const nppes = v.coverage.find((l) => l.source === 'NPPES');
    expect(nppes?.ambiguityVisible).toBe(false);
  });

  it('STALE lane IS ambiguity-visible', () => {
    const v = deriveProofManifestView(FULL_MANIFEST);
    const oig = v.coverage.find((l) => l.source === 'OIG');
    expect(oig?.ambiguityVisible).toBe(true);
  });

  it('FAILED lane IS ambiguity-visible', () => {
    const v = deriveProofManifestView({
      ...FULL_MANIFEST,
      coverage: [{ source: 'PECOS', laneType: 'enrollment', status: 'FAILED' }],
    });
    expect(v.coverage[0]?.ambiguityVisible).toBe(true);
  });

  it('VERIFIED lane is NOT ambiguity-visible (case-insensitive)', () => {
    const v = deriveProofManifestView({
      ...FULL_MANIFEST,
      coverage: [{ source: 'PECOS', laneType: 'enrollment', status: 'verified' }],
    });
    expect(v.coverage[0]?.ambiguityVisible).toBe(false);
  });

  it('UNKNOWN status defaults to ambiguity-visible', () => {
    const v = deriveProofManifestView({
      ...FULL_MANIFEST,
      coverage: [{ source: 'X', laneType: 'y' }], // no status
    });
    expect(v.coverage[0]?.status).toBe('UNKNOWN');
    expect(v.coverage[0]?.ambiguityVisible).toBe(true);
  });
});

describe('W4-PR248A — deriveProofManifestView: aggregate verdict', () => {
  it('one OK + one STALE → partial', () => {
    const v = deriveProofManifestView(FULL_MANIFEST);
    expect(v.aggregateVerdict).toBe('partial');
  });

  it('all OK → verified-source-data (compound label, never bare Verified)', () => {
    const v = deriveProofManifestView({
      ...FULL_MANIFEST,
      coverage: [
        { source: 'A', laneType: 'x', status: 'OK' },
        { source: 'B', laneType: 'y', status: 'OK' },
      ],
    });
    expect(v.aggregateVerdict).toBe('verified-source-data');
  });

  it('all FAILED → no-coverage', () => {
    const v = deriveProofManifestView({
      ...FULL_MANIFEST,
      coverage: [
        { source: 'A', laneType: 'x', status: 'FAILED' },
        { source: 'B', laneType: 'y', status: 'STALE' },
      ],
    });
    expect(v.aggregateVerdict).toBe('no-coverage');
  });

  it('empty coverage but complete manifest → unknown (no inference)', () => {
    const v = deriveProofManifestView({ ...FULL_MANIFEST, coverage: [] });
    expect(v.aggregateVerdict).toBe('unknown');
  });
});

describe('W4-PR248A — ProofManifestPanel: render-time truth contract', () => {
  it('renders an ambiguity banner when manifest is incomplete', () => {
    const html = renderToStaticMarkup(<ProofManifestPanel manifest={null} />);
    expect(html).toContain('Manifest was returned incomplete');
    expect(html).toContain('proof-manifest-ambiguity-banner');
  });

  it('renders aggregate verdict as a compound label, never bare-word Verified', () => {
    const html = renderToStaticMarkup(<ProofManifestPanel manifest={FULL_MANIFEST} />);
    // Compound label is "Partial coverage" for the test fixture.
    expect(html).toContain('Partial coverage');
    expect(html).not.toMatch(/>\s*Verified\s*</);
    // Compound "Source-backed evidence" appears when all lanes OK.
    const okHtml = renderToStaticMarkup(
      <ProofManifestPanel
        manifest={{
          ...FULL_MANIFEST,
          coverage: [{ source: 'NPPES', laneType: 'identity', status: 'OK' }],
        }}
      />,
    );
    expect(okHtml).toContain('Source-backed evidence');
    expect(okHtml).not.toMatch(/>\s*Verified\s*</);
  });

  it('marks ambiguity-visible lanes explicitly', () => {
    const html = renderToStaticMarkup(<ProofManifestPanel manifest={FULL_MANIFEST} />);
    expect(html).toContain('data-ambiguity-visible="true"');
    expect(html).toContain('Ambiguity-visible');
  });

  it('shows "No limitations recorded" empty state — never "Clean" or "All clear"', () => {
    const html = renderToStaticMarkup(
      <ProofManifestPanel manifest={{ ...FULL_MANIFEST, limitations: [] }} />,
    );
    expect(html).toContain('No limitations recorded');
    expect(html).not.toMatch(/>\s*Clean\s*</);
    expect(html).not.toMatch(/>\s*All clear\s*</);
  });

  it('does not render the coverage section when manifest is incomplete', () => {
    const html = renderToStaticMarkup(<ProofManifestPanel manifest={null} />);
    expect(html).not.toContain('proof-manifest-coverage');
  });
});

describe('W4-PR248A — banned-strings scan on rendered output', () => {
  const html = renderToStaticMarkup(<ProofManifestPanel manifest={FULL_MANIFEST} />);
  it.each(BANNED)('rendered panel does not contain banned phrase: %s', (phrase) => {
    expect(html).not.toContain(phrase);
  });
});
