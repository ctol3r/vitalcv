jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    organizationProfile: {
      findUnique: jest.fn(),
    },
    verificationArtifact: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    candidateCredential: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../identity/npiDidBinding', () => ({
  __esModule: true,
  getBindingByDid: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { getBindingByDid } from '../../identity/npiDidBinding';
import {
  buildTrustStateChecksum,
  buildTrustStateSnapshot,
  computeTrustState,
} from '../trustStateService';

const prismaMock = prisma as unknown as {
  organizationProfile: { findUnique: jest.Mock };
  verificationArtifact: {
    findMany: jest.Mock;
    create: jest.Mock;
  };
  candidateCredential: { findMany: jest.Mock };
};

const getBindingByDidMock = getBindingByDid as jest.Mock;

describe('trustStateService', () => {
  const originalEnv = process.env.FEATURE_READINESS_ENGINE;

  beforeEach(() => {
    process.env.FEATURE_READINESS_ENGINE = 'true';
    prismaMock.organizationProfile.findUnique.mockReset();
    prismaMock.verificationArtifact.findMany.mockReset();
    prismaMock.verificationArtifact.create.mockReset();
    prismaMock.candidateCredential.findMany.mockReset();
    getBindingByDidMock.mockReset();
  });

  afterAll(() => {
    process.env.FEATURE_READINESS_ENGINE = originalEnv;
  });

  it('produces deterministic snapshots for identical frozen inputs', () => {
    const now = new Date('2026-03-13T00:00:00.000Z');
    const snapshotA = buildTrustStateSnapshot({
      subjectDid: 'did:vitalcv:npi:test',
      subjectNpi: '1234567890',
      contextOrgId: 'org-1',
      workflowContext: 'job_application',
      requirements: [
        {
          canonicalArtifactKey: 'identity_binding',
          requirementLabel: 'Identity Binding',
          requirementWeight: 3,
          mapped: true,
          source: 'workflow_default',
        },
        {
          canonicalArtifactKey: 'state_license',
          requirementLabel: 'State License',
          requirementWeight: 3,
          mapped: true,
          source: 'workflow_default',
        },
      ],
      binding: {
        id: 'binding-1',
        did: 'did:vitalcv:npi:test',
        npi: '1234567890',
        status: 'ACTIVE',
        updatedAt: now,
        contestReason: null,
      },
      verificationArtifacts: [
        {
          id: 'artifact-1',
          npi: '1234567890',
          source: 'NURSYS',
          status: 'VERIFIED',
          rawPayload: { type: 'license' },
          verifiedAt: new Date('2026-03-01T00:00:00.000Z'),
          expiresAt: null,
          revokedAt: null,
          suspendedAt: null,
          revocationReason: null,
          lifecycleState: 'ACTIVE',
          statusLastChecked: now,
          psvWindowStart: null,
          psvWindowDeadline: null,
          psvWindowCompliant: true,
          organizationId: null,
          trustState: 'verified',
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
        },
      ],
      candidateCredentials: [],
      now,
    });
    const snapshotB = buildTrustStateSnapshot({
      subjectDid: 'did:vitalcv:npi:test',
      subjectNpi: '1234567890',
      contextOrgId: 'org-1',
      workflowContext: 'job_application',
      requirements: [
        {
          canonicalArtifactKey: 'identity_binding',
          requirementLabel: 'Identity Binding',
          requirementWeight: 3,
          mapped: true,
          source: 'workflow_default',
        },
        {
          canonicalArtifactKey: 'state_license',
          requirementLabel: 'State License',
          requirementWeight: 3,
          mapped: true,
          source: 'workflow_default',
        },
      ],
      binding: {
        id: 'binding-1',
        did: 'did:vitalcv:npi:test',
        npi: '1234567890',
        status: 'ACTIVE',
        updatedAt: now,
        contestReason: null,
      },
      verificationArtifacts: [
        {
          id: 'artifact-1',
          npi: '1234567890',
          source: 'NURSYS',
          status: 'VERIFIED',
          rawPayload: { type: 'license' },
          verifiedAt: new Date('2026-03-01T00:00:00.000Z'),
          expiresAt: null,
          revokedAt: null,
          suspendedAt: null,
          revocationReason: null,
          lifecycleState: 'ACTIVE',
          statusLastChecked: now,
          psvWindowStart: null,
          psvWindowDeadline: null,
          psvWindowCompliant: true,
          organizationId: null,
          trustState: 'verified',
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
        },
      ],
      candidateCredentials: [],
      now,
    });

    expect(snapshotA).toEqual(snapshotB);
    expect(buildTrustStateChecksum(snapshotA)).toBe(buildTrustStateChecksum(snapshotB));
    expect(snapshotA.readinessScore).toBe(100);
    expect(snapshotA.readinessStatus).toBe('READY');
  });

  it('persists a NOT_READY snapshot when the DID binding is contested', async () => {
    getBindingByDidMock.mockResolvedValue({
      id: 'binding-1',
      did: 'did:vitalcv:npi:test',
      npi: '1234567890',
      status: 'CONTESTED',
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
      contestReason: 'fingerprint mismatch',
    });
    prismaMock.organizationProfile.findUnique.mockResolvedValue(null);
    prismaMock.verificationArtifact.create.mockResolvedValue({ id: 'snapshot-1' });

    const snapshot = await computeTrustState('did:vitalcv:npi:test', 'org-1');

    expect(snapshot.readinessStatus).toBe('NOT_READY');
    expect(snapshot.readinessLevel).toBe('L0');
    expect(prismaMock.verificationArtifact.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.verificationArtifact.create.mock.calls[0][0].data.status).toBe('NOT_READY');
    expect(snapshot.warnings.join(' ')).toContain('Identity');
  });
});
