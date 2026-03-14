jest.mock('../../src/graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
    decisionCapsule: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    knowledgeNode: {
      upsert: jest.fn(),
    },
    authorityEdge: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import prisma from '../../src/graphql/prisma_client';
import { createAuthorityEdges } from '../decisionCapsules.repo';

const prismaMock = prisma as unknown as {
  knowledgeNode: {
    upsert: jest.Mock;
  };
  authorityEdge: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
};

describe('decisionCapsules.repo', () => {
  beforeEach(() => {
    prismaMock.knowledgeNode.upsert.mockReset();
    prismaMock.authorityEdge.findFirst.mockReset();
    prismaMock.authorityEdge.create.mockReset();

    prismaMock.knowledgeNode.upsert
      .mockResolvedValueOnce({ id: 'node-clinician' })
      .mockResolvedValueOnce({ id: 'node-decision' })
      .mockResolvedValueOnce({ id: 'node-credential' })
      .mockResolvedValueOnce({ id: 'node-issuer' })
      .mockResolvedValueOnce({ id: 'node-employer' })
      .mockResolvedValueOnce({ id: 'node-facility' });
    prismaMock.authorityEdge.findFirst.mockResolvedValue(null);
    prismaMock.authorityEdge.create.mockResolvedValue({});
  });

  test('persists clinician, evidence, issuer, and verifier authority edges with decision metadata', async () => {
    await createAuthorityEdges({
      capsuleId: 'capsule-1',
      subjectDid: 'did:vitalcv:1003000126',
      subjectNpi: '1003000126',
      verifierOrgId: 'org-1',
      decisionType: 'HIRING',
      decisionAction: 'CONDITIONAL_APPROVE',
      credentialIds: ['cred-1'],
      issuerIds: ['issuer-1'],
      artifactHash: 'a'.repeat(64),
      methodologyVersion: 'decision_capsule.v262',
      decisionTimestamp: '2026-03-14T12:00:00.000Z',
      triggerEvent: 'verifier_decision',
    });

    expect(prismaMock.authorityEdge.create).toHaveBeenCalledTimes(5);
    expect(prismaMock.authorityEdge.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        sourceNodeId: 'node-clinician',
        targetNodeId: 'node-decision',
        relationType: 'DECISION_SUBJECT',
        metadata: expect.objectContaining({
          capsuleId: 'capsule-1',
          decisionAction: 'CONDITIONAL_APPROVE',
        }),
      }),
    });
    expect(prismaMock.authorityEdge.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        sourceNodeId: 'node-credential',
        targetNodeId: 'node-decision',
        relationType: 'DECISION_EVIDENCE',
      }),
    });
    expect(prismaMock.authorityEdge.create).toHaveBeenNthCalledWith(3, {
      data: expect.objectContaining({
        sourceNodeId: 'node-issuer',
        targetNodeId: 'node-decision',
        relationType: 'DECISION_ISSUER',
      }),
    });
    expect(prismaMock.authorityEdge.create).toHaveBeenNthCalledWith(4, {
      data: expect.objectContaining({
        sourceNodeId: 'node-employer',
        targetNodeId: 'node-decision',
        relationType: 'DECISION_EMPLOYER',
      }),
    });
    expect(prismaMock.authorityEdge.create).toHaveBeenNthCalledWith(5, {
      data: expect.objectContaining({
        sourceNodeId: 'node-clinician',
        targetNodeId: 'node-facility',
        relationType: 'ACCEPTED_BY',
      }),
    });
  });
});
