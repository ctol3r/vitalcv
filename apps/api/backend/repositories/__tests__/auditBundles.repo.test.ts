jest.mock('../../src/graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: {
      findMany: jest.fn(),
    },
    verificationRun: {
      findMany: jest.fn(),
    },
    decisionCapsule: {
      findMany: jest.fn(),
    },
    auditSnapshot: {
      create: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../../src/services/transparencyLog', () => ({
  __esModule: true,
  getTransparencyEntries: jest.fn(),
}));

jest.mock('../../src/services/verifierAuditBundle', () => ({
  __esModule: true,
  AUDITSCRAPBOOK_COMPLIANCE_PROFILE: 'NCQA-PSV',
  AUDITSCRAPBOOK_METHOD: 'AUDITSCRAPBOOK',
  AUDITSCRAPBOOK_METHODLOGY_VERSION: 'audit_scrapbook.v1',
  AUDITSCRAPBOOK_VERIFIER_IDENTITY: 'VitalCV Verifier',
  buildVerifierAuditBundle: jest.fn(),
}));

import prisma from '../../src/graphql/prisma_client';
import { getTransparencyEntries } from '../../src/services/transparencyLog';
import { buildVerifierAuditBundle } from '../../src/services/verifierAuditBundle';
import {
  generateAuditBundle,
  getCredentialEvidence,
} from '../auditBundles.repo';

const prismaMock = prisma as unknown as {
  verificationArtifact: {
    findMany: jest.Mock;
  };
  verificationRun: {
    findMany: jest.Mock;
  };
  decisionCapsule: {
    findMany: jest.Mock;
  };
  auditSnapshot: {
    create: jest.Mock;
  };
  auditEvent: {
    create: jest.Mock;
  };
};

const getTransparencyEntriesMock = getTransparencyEntries as jest.MockedFunction<
  typeof getTransparencyEntries
>;
const buildVerifierAuditBundleMock = buildVerifierAuditBundle as jest.MockedFunction<
  typeof buildVerifierAuditBundle
>;

function buildCompatibilityArtifact() {
  return {
    id: 'compat-1',
    npi: '1234567890',
    source: 'STATE_BOARD',
    status: 'ACTIVE',
    rawPayload: { licenseNumber: 'CA-1', verification_method: 'API' },
    revokedAt: null,
    suspendedAt: null,
    revocationReason: null,
    lifecycleState: 'ACTIVE',
    statusLastChecked: new Date('2026-03-14T12:00:00.000Z'),
    checksum: 'evidence-hash-1',
    merkleRoot: 'merkle-root-1',
    claimHashes: [],
    verifiedAt: new Date('2026-03-10T00:00:00.000Z'),
    expiresAt: new Date('2027-03-10T00:00:00.000Z'),
    monitoring: true,
    trustState: 'VERIFIED',
    organizationId: 'org-1',
    psvWindowStart: null,
    psvWindowDeadline: new Date('2026-06-10T00:00:00.000Z'),
    psvWindowCompliant: true,
    daysUntilExpiration: 365,
    forecastRiskLevel: 'LOW',
    createdAt: new Date('2026-03-10T00:00:00.000Z'),
  };
}

describe('auditBundles.repo', () => {
  beforeEach(() => {
    prismaMock.verificationArtifact.findMany.mockReset();
    prismaMock.verificationRun.findMany.mockReset();
    prismaMock.decisionCapsule.findMany.mockReset();
    prismaMock.auditSnapshot.create.mockReset();
    prismaMock.auditEvent.create.mockReset();
    getTransparencyEntriesMock.mockReset();
    buildVerifierAuditBundleMock.mockReset();

    getTransparencyEntriesMock.mockResolvedValue([]);
    buildVerifierAuditBundleMock.mockReturnValue({
      tamperAnchoring: {
        chainDigest: 'chain-digest-1',
      },
    } as ReturnType<typeof buildVerifierAuditBundle>);
    prismaMock.auditSnapshot.create.mockResolvedValue({ id: 'snapshot-1' });
    prismaMock.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
    prismaMock.decisionCapsule.findMany.mockResolvedValue([]);
  });

  it('prefers canonical ingestion artifacts when they exist for the NPI', async () => {
    prismaMock.verificationArtifact.findMany.mockResolvedValue([buildCompatibilityArtifact()]);
    prismaMock.verificationRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        retrievedAtUtc: new Date('2026-03-11T00:00:00.000Z'),
        artifacts: [
          {
            id: 'credential-artifact-1',
            artifactJson: {
              kind: 'credential_artifact',
              subject_npi: '1234567890',
              source_name: 'state-board',
              credential_type: 'STATE_LICENSE',
              issuer_org_id: 'issuer-1',
              credential_hash: 'credential-hash-1',
              issued_at: '2026-03-01T00:00:00.000Z',
              expires_at: '2027-03-01T00:00:00.000Z',
              status: 'ACTIVE',
            },
          },
          {
            id: 'verification-artifact-1',
            artifactJson: {
              kind: 'verification_artifact',
              subject_npi: '1234567890',
              source_name: 'state-board',
              related_credential_hash: 'credential-hash-1',
              source_type: 'STATE_BOARD',
              verification_method: 'API',
              evidence_hash: 'evidence-hash-1',
              verified_at: '2026-03-10T00:00:00.000Z',
              fresh_until: '2026-06-10T00:00:00.000Z',
              payload_json: { licenseNumber: 'CA-1' },
            },
          },
        ],
      },
    ]);

    const evidence = await getCredentialEvidence('1234567890', { organizationId: 'org-1' });

    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toEqual(expect.objectContaining({
      credentialId: 'credential-artifact-1',
      verificationArtifactId: 'verification-artifact-1',
      relatedCompatibilityArtifactId: 'compat-1',
      credentialType: 'STATE_LICENSE',
      issuerId: 'issuer-1',
    }));
  });

  it('falls back to compatibility verification artifacts when canonical ingestion data is absent', async () => {
    prismaMock.verificationArtifact.findMany.mockResolvedValue([buildCompatibilityArtifact()]);
    prismaMock.verificationRun.findMany.mockResolvedValue([]);

    const evidence = await getCredentialEvidence('1234567890', { organizationId: 'org-1' });

    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toEqual(expect.objectContaining({
      credentialId: 'compat-1',
      verificationArtifactId: 'compat-1',
      relatedCompatibilityArtifactId: 'compat-1',
      credentialType: 'STATE_LICENSE',
      verificationMethod: 'API',
    }));
  });

  it('generates an additive audit scrapbook bundle linked to decision capsules', async () => {
    prismaMock.verificationArtifact.findMany.mockResolvedValue([buildCompatibilityArtifact()]);
    prismaMock.verificationRun.findMany.mockResolvedValue([]);
    prismaMock.decisionCapsule.findMany.mockResolvedValue([
      {
        id: 'capsule-1',
        decisionType: 'HIRING',
        credentialIds: ['compat-1'],
        metadata: {},
      },
    ]);

    const bundle = await generateAuditBundle('1234567890', { organizationId: 'org-1' });

    expect(bundle.artifact.id).toBe('compat-1');
    expect(bundle.verifierAuditBundle).toEqual(expect.objectContaining({
      tamperAnchoring: expect.objectContaining({
        chainDigest: 'chain-digest-1',
      }),
    }));
    expect(bundle.auditScrapbookBundle).toEqual(expect.objectContaining({
      schemaVersion: 'audit_scrapbook.v1',
    }));
    expect(bundle.auditScrapbookBundle.entries[0]).toEqual(expect.objectContaining({
      credentialId: 'compat-1',
      decisionCapsuleIds: ['capsule-1'],
      decisionTypes: ['HIRING'],
    }));
    expect(bundle.auditScrapbookBundle.entries[0].verificationMetadata).toEqual(
      expect.objectContaining({
        sourceResponseHash: expect.any(String),
        normalizedFactsHash: expect.any(String),
      }),
    );
  });
});
