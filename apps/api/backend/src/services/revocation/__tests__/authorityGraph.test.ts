jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: {
      findUnique: jest.fn(),
    },
    decisionCapsule: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    knowledgeNode: {
      upsert: jest.fn(),
    },
    authorityEdge: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import prisma from '../../../graphql/prisma_client';
import {
  ensureDecisionCapsuleAuthorityGraph,
  findDecisionCapsulesByCredential,
} from '../authorityGraph';

const prismaMock = prisma as unknown as {
  verificationArtifact: {
    findUnique: jest.Mock;
  };
  decisionCapsule: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
  };
  knowledgeNode: {
    upsert: jest.Mock;
  };
  authorityEdge: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
  };
};

describe('authorityGraph', () => {
  beforeEach(() => {
    prismaMock.verificationArtifact.findUnique.mockReset();
    prismaMock.decisionCapsule.findUnique.mockReset();
    prismaMock.decisionCapsule.findMany.mockReset();
    prismaMock.knowledgeNode.upsert.mockReset();
    prismaMock.authorityEdge.findFirst.mockReset();
    prismaMock.authorityEdge.findMany.mockReset();
    prismaMock.authorityEdge.create.mockReset();
  });

  it('repairs missing capsule nodes and DEPENDS_ON edges before traversal', async () => {
    prismaMock.verificationArtifact.findUnique.mockResolvedValue({
      id: 'cred-1',
      npi: '1234567890',
      source: 'NURSYS',
      status: 'VERIFIED',
      organizationId: null,
    });

    prismaMock.knowledgeNode.upsert
      .mockResolvedValueOnce({
        id: 'node-cred-1',
        entityType: 'CREDENTIAL',
        entityId: 'cred-1',
      })
      .mockResolvedValueOnce({
        id: 'node-cap-1',
        entityType: 'DECISION_CAPSULE',
        entityId: 'cap-1',
      })
      .mockResolvedValueOnce({
        id: 'node-cap-2',
        entityType: 'DECISION_CAPSULE',
        entityId: 'cap-2',
      });

    prismaMock.decisionCapsule.findMany.mockImplementation(async (args?: {
      where?: {
        credentialIds?: { has?: string };
        id?: { in?: string[] };
      };
    }) => {
      if (args?.where?.credentialIds?.has === 'cred-1') {
        return [
          {
            id: 'cap-1',
            subjectDid: 'did:vitalcv:clinician:1',
            subjectNpi: '1234567890',
            decisionType: 'HIRING',
            status: 'VALID',
          },
          {
            id: 'cap-2',
            subjectDid: 'did:vitalcv:clinician:1',
            subjectNpi: '1234567890',
            decisionType: 'PRIVILEGING',
            status: 'AT_RISK',
          },
        ];
      }

      return [
        {
          id: 'cap-1',
          subjectDid: 'did:vitalcv:clinician:1',
          subjectNpi: '1234567890',
          decisionType: 'HIRING',
          status: 'VALID',
          metadata: { trust_state_snapshot: { readiness_level: 'L3' } },
        },
        {
          id: 'cap-2',
          subjectDid: 'did:vitalcv:clinician:1',
          subjectNpi: '1234567890',
          decisionType: 'PRIVILEGING',
          status: 'AT_RISK',
          metadata: {},
        },
      ];
    });

    prismaMock.authorityEdge.findFirst.mockResolvedValue(null);
    prismaMock.authorityEdge.findMany.mockResolvedValue([
      {
        source: {
          entityType: 'DECISION_CAPSULE',
          entityId: 'cap-2',
        },
      },
      {
        source: {
          entityType: 'DECISION_CAPSULE',
          entityId: 'cap-1',
        },
      },
    ]);
    prismaMock.authorityEdge.create.mockResolvedValue({});

    const impacted = await findDecisionCapsulesByCredential('cred-1');

    expect(impacted.map((capsule) => capsule.id).sort()).toEqual(['cap-1', 'cap-2']);
    expect(prismaMock.knowledgeNode.upsert).toHaveBeenCalledTimes(3);
    expect(prismaMock.authorityEdge.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.authorityEdge.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        relationType: 'DEPENDS_ON',
        sourceNodeId: 'node-cap-1',
        targetNodeId: 'node-cred-1',
      }),
    });
    expect(prismaMock.authorityEdge.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        relationType: 'DEPENDS_ON',
        sourceNodeId: 'node-cap-2',
        targetNodeId: 'node-cred-1',
      }),
    });
  });

  it('does not recreate existing DEPENDS_ON edges during capsule graph seeding', async () => {
    prismaMock.decisionCapsule.findUnique.mockResolvedValue({
      id: 'cap-1',
      subjectDid: 'did:vitalcv:clinician:1',
      subjectNpi: '1234567890',
      decisionType: 'HIRING',
      status: 'VALID',
      metadata: {},
      credentialIds: ['cred-1'],
    });
    prismaMock.verificationArtifact.findUnique.mockResolvedValue({
      id: 'cred-1',
      npi: '1234567890',
      source: 'NURSYS',
      status: 'VERIFIED',
      organizationId: null,
    });
    prismaMock.knowledgeNode.upsert
      .mockResolvedValueOnce({
        id: 'node-cap-1',
        entityType: 'DECISION_CAPSULE',
        entityId: 'cap-1',
      })
      .mockResolvedValueOnce({
        id: 'node-cred-1',
        entityType: 'CREDENTIAL',
        entityId: 'cred-1',
      });
    prismaMock.authorityEdge.findFirst.mockResolvedValue({ id: 'edge-1' });

    await ensureDecisionCapsuleAuthorityGraph('cap-1');

    expect(prismaMock.authorityEdge.create).not.toHaveBeenCalled();
  });
});
