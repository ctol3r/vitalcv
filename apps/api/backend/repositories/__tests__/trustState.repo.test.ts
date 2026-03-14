jest.mock('../../src/graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import prisma from '../../src/graphql/prisma_client';
import {
  findLatestTrustState,
  persistTrustStateSnapshot,
} from '../trustState.repo';

const prismaMock = prisma as unknown as {
  verificationArtifact: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
};

describe('trustState.repo', () => {
  beforeEach(() => {
    prismaMock.verificationArtifact.create.mockReset();
    prismaMock.verificationArtifact.findMany.mockReset();
  });

  it('persists synthetic trust-state snapshots with compatibility metadata', async () => {
    prismaMock.verificationArtifact.create.mockResolvedValue({ id: 'snapshot-1' });

    await persistTrustStateSnapshot({
      subjectDid: 'did:vitalcv:npi:test',
      subjectNpi: '1234567890',
      contextOrgId: 'org-1',
      workflowContext: 'job_application',
      readinessScore: 100,
      readinessLevel: 'L3',
      readinessStatus: 'READY',
      artifactStatuses: [],
      warnings: [],
      methodologyVersion: 'wave253.v1',
      generatedAt: '2026-03-13T00:00:00.000Z',
    });

    const createCall = prismaMock.verificationArtifact.create.mock.calls[0][0];
    expect(createCall.data.source).toBe('TRUST_STATE_ENGINE_V2');
    expect(createCall.data.status).toBe('READY');
    expect(createCall.data.trustState).toBe('L3');
    expect(createCall.data.organizationId).toBe('org-1');
    expect(typeof createCall.data.checksum).toBe('string');
  });

  it('finds the latest snapshot for the requested subject and workflow context', async () => {
    prismaMock.verificationArtifact.findMany.mockResolvedValue([
      {
        rawPayload: {
          subjectDid: 'did:vitalcv:npi:other',
          subjectNpi: '2234567890',
          contextOrgId: 'org-1',
          workflowContext: 'job_application',
          readinessScore: 0,
          readinessLevel: 'L0',
          readinessStatus: 'NOT_READY',
          artifactStatuses: [],
          warnings: [],
          methodologyVersion: 'wave253.v1',
          generatedAt: '2026-03-13T00:00:00.000Z',
        },
      },
      {
        rawPayload: {
          subjectDid: 'did:vitalcv:npi:test',
          subjectNpi: '1234567890',
          contextOrgId: 'org-1',
          workflowContext: 'job_application',
          readinessScore: 100,
          readinessLevel: 'L3',
          readinessStatus: 'READY',
          artifactStatuses: [],
          warnings: [],
          methodologyVersion: 'wave253.v1',
          generatedAt: '2026-03-13T01:00:00.000Z',
        },
      },
    ]);

    const snapshot = await findLatestTrustState(
      'did:vitalcv:npi:test',
      'org-1',
      'job_application',
    );

    expect(snapshot?.subjectDid).toBe('did:vitalcv:npi:test');
    expect(snapshot?.workflowContext).toBe('job_application');
    expect(prismaMock.verificationArtifact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        source: 'TRUST_STATE_ENGINE_V2',
        organizationId: 'org-1',
      }),
    }));
  });
});
