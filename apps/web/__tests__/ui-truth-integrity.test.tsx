import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { normalizeEmployerEvidencePacket } from '@/lib/trust/employer-packet-contract';
import {
  areRequiredFlowStagesResolved,
  assertAtomicRender,
  assertNoArtificialLatency,
  assertNoProgressiveComputation,
  buildSelectiveDisclosureSnapshot,
  buildUiTruthSnapshot,
  hasDecisionGradeSignals,
  resolveAtomicTruthRenderState,
  resolvePublicDecisionTruthStatus,
  resolvePublicNextBestActionTruthStatus,
  toAtomicManifest,
} from '@/lib/trust/ui-truth-integrity';
import { EvidencePanel } from '@/app/p/[slug]/EvidencePanel';
import { DivergencePanel } from '@/app/p/[slug]/DivergencePanel';

function buildEmployerPacket(overrides: {
  receiptReferences?: Array<{ sourceId: string; receiptId: string }>;
  sourceReceiptIds?: string[];
  sourceState?: string;
} = {}) {
  const receiptReferences = overrides.receiptReferences ?? [
    { sourceId: 'STATE_BOARD', receiptId: 'receipt-1' },
  ];
  const sourceReceiptIds = overrides.sourceReceiptIds ?? ['receipt-1'];
  const sourceState = overrides.sourceState ?? 'checked';

  return {
    schema: 'vitalcv.employer.packet.v1',
    exportedAt: '2026-04-14T12:00:00.000Z',
    exportedBy: 'clerk-user-1',
    entityId: 'entity-1',
    clinicianNpi: '1234567890',
    displayName: 'Ada Lovelace',
    truth: {
      identity: { status: 'VERIFIED' },
      safety: { status: 'CLEAR' },
      authority: { status: 'VERIFIED' },
      eligibility: { status: 'ENROLLED' },
    },
    manifest: {
      schema: 'vitalcv.employer.packet-manifest.v1',
      packetSchema: 'vitalcv.employer.packet.v1',
      exportedAt: '2026-04-14T12:00:00.000Z',
      exportedBy: 'clerk-user-1',
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
      bundleFiles: ['packet.json'],
      receiptReferences,
      artifactReferences: [{ sourceId: 'STATE_BOARD', artifactId: 'artifact-1' }],
      sourceCoverage: {
        checks: [
          {
            sourceId: 'STATE_BOARD',
            state: sourceState,
            reason: 'License check attached.',
            checkedAt: '2026-04-14T12:00:00.000Z',
          },
        ],
      },
      freshness: {},
      status: {},
      sources: [
        {
          sourceId: 'STATE_BOARD',
          truthStatus: 'VERIFIED',
          state: sourceState,
          reason: 'License check attached.',
          checkedAt: '2026-04-14T12:00:00.000Z',
          observedAt: '2026-04-14T12:00:00.000Z',
          expiresAt: null,
          credentialExpiresAt: null,
          freshness: {
            status: 'current',
            checkedAt: '2026-04-14T12:00:00.000Z',
            observedAt: '2026-04-14T12:00:00.000Z',
            expiresAt: null,
            freshnessWindowHours: 24,
          },
          provenance: {
            artifactId: 'artifact-1',
            artifactIds: ['artifact-1'],
            receiptIds: sourceReceiptIds,
            sourceUrl: null,
            rawArtifactRef: null,
            checksum: 'checksum-1',
            parserVersion: 'parser-1',
          },
          parserVersion: 'parser-1',
          checksum: 'checksum-1',
          sourceUrl: null,
          rawArtifactRef: null,
          freshnessWindowHours: 24,
          confidenceLabel: null,
          reviewRequired: false,
          artifactId: 'artifact-1',
          artifactIds: ['artifact-1'],
          receiptIds: sourceReceiptIds,
        },
      ],
    },
    receiptReferences,
    artifactReferences: [{ sourceId: 'STATE_BOARD', artifactId: 'artifact-1' }],
    sourceCoverage: {
      checks: [
        {
          sourceId: 'STATE_BOARD',
          state: sourceState,
          reason: 'License check attached.',
          checkedAt: '2026-04-14T12:00:00.000Z',
        },
      ],
    },
    freshness: {},
    identity: {},
    safety: {},
    authority: {},
    eligibility: {},
    readiness: {},
  };
}

describe('ui truth integrity', () => {
  it('only treats L3 as decision-grade proof', () => {
    expect(hasDecisionGradeSignals('L3')).toBe(true);
    expect(hasDecisionGradeSignals('l3')).toBe(true);
    expect(hasDecisionGradeSignals('L2')).toBe(false);
    expect(hasDecisionGradeSignals(null)).toBe(false);
  });

  it('downgrades positive public decisions when decision-grade proof is missing', () => {
    expect(resolvePublicDecisionTruthStatus({
      decision: 'PROCEED',
      readinessLevel: 'L2',
    })).toBe('INSUFFICIENT_DATA');

    expect(resolvePublicDecisionTruthStatus({
      decision: 'PROCEED_WITH_CAUTION',
      readinessLevel: 'L1',
    })).toBe('INSUFFICIENT_DATA');

    expect(resolvePublicDecisionTruthStatus({
      decision: 'DO_NOT_PROCEED',
      readinessLevel: 'L2',
    })).toBe('DO_NOT_PROCEED');
  });

  it('downgrades proceed guidance when decision-grade proof is missing', () => {
    expect(resolvePublicNextBestActionTruthStatus({
      action: 'PROCEED',
      readinessLevel: 'L2',
    })).toBe('REVIEW_MANUALLY');

    expect(resolvePublicNextBestActionTruthStatus({
      action: 'REVERIFY',
      readinessLevel: 'L2',
    })).toBe('REVERIFY');

    expect(resolvePublicNextBestActionTruthStatus({
      action: 'PROCEED',
      readinessLevel: 'L3',
    })).toBe('PROCEED');
  });

  it('rejects a checked employer packet when the manifest source has no receipt', () => {
    const packet = buildEmployerPacket({ sourceReceiptIds: [] });
    expect(normalizeEmployerEvidencePacket(packet)).toBeNull();
  });

  it('rejects a checked employer packet when the receipt reference does not match the source receipt', () => {
    const packet = buildEmployerPacket({
      sourceReceiptIds: ['receipt-1'],
      receiptReferences: [{ sourceId: 'STATE_BOARD', receiptId: 'receipt-2' }],
    });

    expect(normalizeEmployerEvidencePacket(packet)).toBeNull();
  });

  it('accepts a checked employer packet when the manifest source maps to a real receipt reference', () => {
    const packet = buildEmployerPacket();
    const normalized = normalizeEmployerEvidencePacket(packet);

    expect(normalized).not.toBeNull();
    expect(normalized?.manifest.sources[0]?.receiptIds).toEqual(['receipt-1']);
    expect(normalized?.manifest.receiptReferences).toEqual([
      { sourceId: 'STATE_BOARD', receiptId: 'receipt-1' },
    ]);
  });

  it('renders public evidence with checked wording instead of verified wording', () => {
    const manifest = toAtomicManifest({
      coverage: {
        checks: [
          {
            sourceId: 'NPPES_API',
            state: 'checked',
            checkedAt: '2026-04-14T12:00:00.000Z',
          },
          {
            sourceId: 'OIG_LEIE',
            state: 'checked',
            checkedAt: '2026-04-14T12:00:00.000Z',
          },
          {
            sourceId: 'STATE_BOARD',
            state: 'checked',
            checkedAt: '2026-04-14T12:00:00.000Z',
          },
        ],
      },
    });

    expect(manifest).not.toBeNull();
    const markup = renderToStaticMarkup(
      <EvidencePanel
        manifest={manifest!}
      />,
    );

    expect(markup).toContain('data-atomic-render-state="resolved"');
    expect(markup).toContain('Last checked');
    expect(markup).toContain('Match on file');
    expect(markup).toContain('OIG Exclusion');
    expect(markup).toContain('License Status');
    expect(markup).not.toContain('Last verified');
    expect(markup).not.toContain('Verified match');
    expect(markup).not.toContain('Verification is still running.');
  });

  it('waits for all required source lanes before rendering evidence rows', () => {
    const manifest = toAtomicManifest({
      coverage: {
        checks: [
          {
            sourceId: 'NPPES_API',
            state: 'checked',
            checkedAt: '2026-04-14T12:00:00.000Z',
          },
          {
            sourceId: 'OIG_LEIE',
            state: 'pending',
            checkedAt: '2026-04-14T12:00:00.000Z',
          },
          {
            sourceId: 'STATE_BOARD',
            state: 'checked',
            checkedAt: '2026-04-14T12:00:00.000Z',
          },
        ],
      },
    });

    expect(manifest).toBeNull();
  });

  it('renders source agreement with checked wording', () => {
    const markup = renderToStaticMarkup(
      <DivergencePanel
        divergence={{
          activeCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          summary: '',
          conflicts: [],
        }}
      />,
    );

    expect(markup).toContain('All checked sources agree');
    expect(markup).not.toContain('All verified sources agree');
  });

  it('builds a UI truth snapshot that keeps receipt status, decision grade, and limitations aligned', () => {
    const packet = buildEmployerPacket({ sourceReceiptIds: [] });

    const snapshot = buildUiTruthSnapshot({
      manifest: {
        manifest: {
          sources: packet.manifest.sources,
          receiptReferences: packet.manifest.receiptReferences,
        },
        receiptReferences: packet.receiptReferences,
      },
      readinessLevel: 'L2',
      decision: 'PROCEED',
      limitations: {
        blockers: ['Decision-grade proof missing'],
        gaps: ['PECOS access requires refresh'],
      },
    });

    expect(snapshot.receiptBackedManifest).toBe(false);
    expect(snapshot.decisionGradeReady).toBe(false);
    expect(snapshot.decisionStatus).toBe('INSUFFICIENT_DATA');
    expect(snapshot.visibleLimitations).toEqual([
      { kind: 'blocker', text: 'Decision-grade proof missing' },
      { kind: 'gap', text: 'PECOS access requires refresh' },
    ]);
  });

  it('treats pending or missing required lanes as not atomically renderable', () => {
    expect(areRequiredFlowStagesResolved({
      coverage: {
        checks: [
          { sourceId: 'NPPES_API', state: 'checked' },
          { sourceId: 'OIG_LEIE', state: 'pending' },
          { sourceId: 'STATE_BOARD', state: 'checked' },
        ],
      },
    })).toBe(false);

    expect(areRequiredFlowStagesResolved({
      coverage: {
        checks: [
          { sourceId: 'NPPES_API', state: 'checked' },
          { sourceId: 'OIG_LEIE', state: 'stale' },
          { sourceId: 'STATE_BOARD', state: 'reviewRequired' },
        ],
      },
    })).toBe(true);
  });

  it('renders resolved truth immediately with no artificial wait state', () => {
    const renderState = resolveAtomicTruthRenderState({
      coverage: {
        checks: [
          { sourceId: 'NPPES_API', state: 'checked' },
          { sourceId: 'OIG_LEIE', state: 'checked' },
          { sourceId: 'STATE_BOARD', state: 'checked' },
        ],
      },
    });

    expect(renderState).toBe('resolved');
    expect(() => assertNoArtificialLatency({
      truthResolved: true,
      renderState,
    })).not.toThrow();
  });

  it('fails if a resolved truth set is forced into an artificial wait state', () => {
    expect(() => assertNoArtificialLatency({
      truthResolved: true,
      renderState: 'waiting',
    })).toThrow('Artificial latency forbidden');
  });

  it('crashes when a partial manifest attempts to enter the resolved render path', () => {
    expect(() => assertAtomicRender(
      { complete: false },
      { renderState: 'resolved' },
    )).toThrow('Partial truth render forbidden');
  });

  it('blocks progressive computation plans', () => {
    expect(() => assertNoProgressiveComputation({
      manifestFetchCount: 2,
    })).toThrow('Progressive computation forbidden');

    expect(() => assertNoProgressiveComputation({
      manifestFetchCount: 1,
      conditionalFetchCount: 1,
    })).toThrow('Progressive computation forbidden');

    expect(() => assertNoProgressiveComputation({
      manifestFetchCount: 1,
      stageFetchCount: 0,
      conditionalFetchCount: 0,
    })).not.toThrow();
  });

  it('builds proof-mode selective disclosure from real receipt-backed fields only', () => {
    const snapshot = buildSelectiveDisclosureSnapshot({
      type: 'STATE_LICENSE',
      name: 'California Medical License',
      issuer: 'Medical Board of California',
      claimLevel: 'L3',
      issueDate: '2026-01-01',
      expirationDate: '2027-01-01',
      licenseId: 'CA-12345',
      psvSnapshotHash: 'hash-1',
      verifierDid: 'did:web:vitalcv.test:issuer',
    }, 'proof');

    expect(snapshot.receiptBacked).toBe(true);
    expect(snapshot.visibleFields).toContain('Receipt attached');
    expect(snapshot.lockedFields).toContain('Issuer: Medical Board of California');
    expect(snapshot.lockedFields).toContain('Identifier: CA-12345');
  });
});
