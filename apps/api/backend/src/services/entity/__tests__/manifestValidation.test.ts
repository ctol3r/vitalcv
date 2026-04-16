jest.mock('../../registry/trustRegistry', () => ({
  getIssuer: jest.fn(),
}));

import { getIssuer } from '../../registry/trustRegistry';
import type { EmployerEvidencePacketV1 } from '../employerPacket';
import {
  applyManifestFailureGuards,
  validateManifest,
} from '../manifestValidation';
import {
  computeReceiptIntegrityHash,
  type VerificationReceipt,
} from '../../identity/evidenceModel';

const getIssuerMock = getIssuer as jest.MockedFunction<typeof getIssuer>;

function buildReceipt(overrides: Partial<VerificationReceipt> = {}): VerificationReceipt {
  const base: VerificationReceipt = {
    receipt_id: 'receipt-1',
    claim_id: 'claim-1',
    entity_id: 'npi:1234567890',
    field: 'NPI',
    value: '1234567890',
    tier: 'GOLD' as VerificationReceipt['tier'],
    confidence: 1,
    source_artifact_id: 'artifact-1',
    source_system: 'NPPES_API',
    observed_at: '2026-04-14T00:00:00.000Z',
    parser_version: 'nppes/v1',
    expires_at: '2026-05-14T00:00:00.000Z',
    explanation: 'Identity verified.',
    integrity_hash: '',
  };

  const receipt = {
    ...base,
    ...overrides,
  };

  return {
    ...receipt,
    integrity_hash: computeReceiptIntegrityHash(receipt),
  };
}

function buildPacket(overrides: Partial<EmployerEvidencePacketV1> = {}): EmployerEvidencePacketV1 {
  return {
    schema: 'vitalcv.employer.packet.v1',
    exportedAt: '2026-04-14T00:00:00.000Z',
    exportedBy: 'employer-1',
    entityId: 'entity-1',
    clinicianNpi: '1234567890',
    displayName: 'Dr. Jane Doe',
    readinessPosture: 'stable',
    truth: {} as EmployerEvidencePacketV1['truth'],
    manifest: {
      schema: 'vitalcv.employer.packet-manifest.v1',
      packetSchema: 'vitalcv.employer.packet.v1',
      exportedAt: '2026-04-14T00:00:00.000Z',
      exportedBy: 'employer-1',
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
      bundleFiles: [],
      receiptReferences: [{ sourceId: 'NPPES_API', receiptId: 'receipt-1' }],
      artifactReferences: [],
      sourceCoverage: {} as EmployerEvidencePacketV1['manifest']['sourceCoverage'],
      sourceCoverageSummary: {} as EmployerEvidencePacketV1['manifest']['sourceCoverageSummary'],
      freshness: {} as EmployerEvidencePacketV1['manifest']['freshness'],
      status: {
        truth: {} as EmployerEvidencePacketV1['manifest']['status']['truth'],
        freshness: {} as EmployerEvidencePacketV1['manifest']['status']['freshness'],
        readiness: {
          status: 'READY',
          score: 80,
          readiness_score: 80,
          level: 'L2',
          blockers: [],
        },
        decisionPosture: {
          status: 'READY',
          headline: 'Ready now.',
          blockers: [],
          nextAction: 'Proceed.',
          freshness: {} as EmployerEvidencePacketV1['decisionPosture']['freshness'],
        },
        sourceCoverageSummary: {} as EmployerEvidencePacketV1['manifest']['status']['sourceCoverageSummary'],
      },
      sources: [{
        sourceId: 'NPPES_API',
        truthStatus: 'VERIFIED',
        state: 'checked',
        reason: 'NPPES checked',
        checkedAt: '2026-04-14T00:00:00.000Z',
        observedAt: '2026-04-14T00:00:00.000Z',
        expiresAt: '2026-05-14T00:00:00.000Z',
        freshness: {
          status: 'current',
          checkedAt: '2026-04-14T00:00:00.000Z',
          observedAt: '2026-04-14T00:00:00.000Z',
          expiresAt: '2026-05-14T00:00:00.000Z',
          freshnessWindowHours: 720,
        },
        provenance: {
          artifactId: 'artifact-1',
          artifactIds: ['artifact-1'],
          receiptIds: ['receipt-1'],
          sourceUrl: 'https://example.test/nppes',
          rawArtifactRef: 'artifact-1',
          checksum: 'checksum-1',
          parserVersion: 'nppes/v1',
        },
        parserVersion: 'nppes/v1',
        checksum: 'checksum-1',
        sourceUrl: 'https://example.test/nppes',
        rawArtifactRef: 'artifact-1',
        freshnessWindowHours: 720,
        confidenceLabel: 'HIGH',
        reviewRequired: false,
        artifactId: 'artifact-1',
        artifactIds: ['artifact-1'],
        receiptIds: ['receipt-1'],
      }],
    },
    receiptReferences: [{ sourceId: 'NPPES_API', receiptId: 'receipt-1' }],
    artifactReferences: [],
    sourceCoverageSummary: {} as EmployerEvidencePacketV1['sourceCoverageSummary'],
    freshness: {} as EmployerEvidencePacketV1['freshness'],
    limitations: {
      items: [],
      blockers: [],
      gaps: [],
    },
    identity: {
      npi: '1234567890',
      displayName: 'Dr. Jane Doe',
      specialty: 'Family Medicine',
      source: 'CMS NPPES',
      checkedAt: '2026-04-14T00:00:00.000Z',
      status: 'confirmed',
      truthStatus: 'VERIFIED',
    },
    safety: {
      exclusionStatus: 'CLEAR',
      exclusionCheckedAt: '2026-04-14T00:00:00.000Z',
      exclusionConfidence: 'HIGH',
      source: 'OIG LEIE',
      isClear: true,
      negativeFindings: [],
      truthStatus: 'CLEAR',
    },
    authority: {
      truthStatus: 'VERIFIED',
      credentials: [{
        domain: 'LICENSURE',
        status: 'ACTIVE',
        jurisdiction: 'CA',
        issuerName: 'California Medical Board',
        sourceId: 'STATE_BOARD',
        observedAt: '2026-04-14T00:00:00.000Z',
        verifiedAt: '2026-04-14T00:00:00.000Z',
        expiresAt: '2027-04-14T00:00:00.000Z',
        freshnessDays: '7 days',
        confidence: 'HIGH',
        claimCode: 'LICENSE_ACTIVE',
        reviewRequired: false,
      }],
      summary: {
        active: 1,
        missing: [],
      },
    },
    eligibility: {
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentNote: null,
      enrollmentDataVersion: '2026-Q2',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentCheckedAt: '2026-04-14T00:00:00.000Z',
      enrollmentConfidence: 'HIGH',
      source: 'CMS PECOS',
      truthStatus: 'ENROLLED',
    },
    readiness: {
      status: 'READY',
      score: 80,
      readiness_score: 80,
      level: 'L2',
      estimatedStartDays: 5,
      blockers: [],
      gaps: [],
      nextActions: [],
    },
    decisionPosture: {
      status: 'READY',
      headline: 'Ready now.',
      blockers: [],
      nextAction: 'Proceed.',
      freshness: {} as EmployerEvidencePacketV1['decisionPosture']['freshness'],
    },
    sourceCoverage: {} as EmployerEvidencePacketV1['sourceCoverage'],
    ...overrides,
  };
}

describe('manifestValidation', () => {
  beforeEach(() => {
    getIssuerMock.mockReset().mockReturnValue({
      issuerId: 'did:vitalcv:issuer:npi-registry',
      issuerName: 'NPI Registry (CMS)',
      publicKey: '',
      trustLevel: 'AUTHORITATIVE',
      status: 'ACTIVE',
      registeredAt: '2025-01-01T00:00:00.000Z',
    } as never);
  });

  it('fails closed when a checked lane is missing a receipt', () => {
    const basePacket = buildPacket();
    const packet = buildPacket({
      manifest: {
        ...basePacket.manifest,
        sources: [{
          ...basePacket.manifest.sources[0]!,
          receiptIds: [],
        }],
      },
    });

    const result = validateManifest(packet, []);

    expect(result.readinessPosture).toBe('review_required');
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'checked_lane_missing_receipt' }),
    ]));
  });

  it('flags invalid receipt integrity as review required', () => {
    const receipt = {
      ...buildReceipt(),
      integrity_hash: 'bad-signature',
    };

    const result = validateManifest(buildPacket(), [receipt]);

    expect(result.readinessPosture).toBe('review_required');
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid_signature' }),
    ]));
  });

  it('flags revoked issuers in receipt validation', () => {
    getIssuerMock.mockReturnValue({
      issuerId: 'did:vitalcv:issuer:npi-registry',
      issuerName: 'NPI Registry (CMS)',
      publicKey: '',
      trustLevel: 'AUTHORITATIVE',
      status: 'REVOKED',
      registeredAt: '2025-01-01T00:00:00.000Z',
    } as never);

    const result = validateManifest(buildPacket(), [buildReceipt()]);

    expect(result.readinessPosture).toBe('review_required');
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'issuer_revoked' }),
    ]));
  });

  it('adds auditable limitations for stale sources', () => {
    const basePacket = buildPacket();
    const packet = buildPacket({
      manifest: {
        ...basePacket.manifest,
        sources: [{
          ...basePacket.manifest.sources[0]!,
          state: 'stale',
          reason: 'NPPES evidence is stale.',
        }],
      },
    });

    const hardened = applyManifestFailureGuards(packet, [buildReceipt()]);

    expect(hardened.readinessPosture).toBe('review_required');
    expect(hardened.limitations.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceId: 'NPPES_API',
        state: 'stale',
        reason: 'NPPES evidence is stale.',
      }),
    ]));
  });

  it('throws when arbitration and explainability disagree', () => {
    const packet = {
      ...buildPacket(),
      arbitratedClaims: [{ claimId: 'claim-1', finalValue: 'ACTIVE' }],
      explainability: {
        winningClaim: {
          claimId: 'claim-1',
          value: 'INACTIVE',
        },
      },
    } as EmployerEvidencePacketV1;

    expect(() => validateManifest(packet, [buildReceipt()])).toThrow(
      'Arbitration/Explainability mismatch',
    );
  });
});
